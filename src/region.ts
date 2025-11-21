import { RegionRenderer, type RegionRendererOptions } from './native/region-renderer';
import { applyStyle } from './utils/colors';
import { getTerminalWidth } from './utils/terminal';
import type { RegionOptions, LineContent } from './types';
import type { Component, RenderContext } from './component';

/**
 * Type guard to check if an item is a Component
 */
function isComponent(item: any): item is Component {
  return item !== null && (
    typeof item === 'function' ||
    (typeof item === 'object' && 'render' in item && typeof item.render === 'function')
  );
}

/**
 * Get the height of a component by calling it with a context
 */
function getComponentHeight(component: Component, region: TerminalRegion, width: number): number {
  const ctx = {
    availableWidth: width,
    region: region,
    columnIndex: 0,
    rowIndex: 0,
  };
  const result = typeof component === 'function' ? component(ctx) : component.render(ctx);
  if (result === null) return 0;
  return Array.isArray(result) ? result.length : 1;
}

/**
 * Render a component and return its content (pure function)
 * The caller is responsible for writing the content to the appropriate position
 */
function renderComponent(component: Component, region: TerminalRegion, width: number): string[] {
  const ctx = {
    availableWidth: width,
    region: region,
    columnIndex: 0,
    rowIndex: 0, // Components don't know their position - caller decides
    // Provide onUpdate callback for animated components (like Spinner)
    onUpdate: () => {
      // Re-render the last content to update animated components
      region.reRenderLastContent();
    },
  };
  
  const result = typeof component === 'function' ? component(ctx) : component.render(ctx);
  
  if (result === null) return [];
  
  // Components return their content - caller writes it to the correct position
  if (Array.isArray(result)) {
    return result.map(line => 
      typeof line === 'string' 
        ? line 
        : applyStyle(line.text, line.style)
    );
  } else {
    const styled = typeof result === 'string'
      ? result
      : applyStyle(result.text, result.style);
    return [styled];
  }
}

/**
 * Reference to a component in the region that can be removed
 */
export class ComponentReference {
  constructor(
    private region: TerminalRegion,
    private componentIndex: number,
    private height: number
  ) {}

  /**
   * Delete this component - removes it from the region
   */
  delete(): void {
    const renderer = this.region.getRenderer();
    const wasRenderingDisabled = renderer.disableRendering;
    renderer.disableRendering = true;

    // Remove component from allComponentDescriptors
    this.region.removeComponent(this.componentIndex);

    // Reduce region height
    this.region.decreaseHeight(this.height);
    renderer.setHeight(this.region.getInternalHeight());

    // Re-render to update the display
    this.region.reRenderLastContent();

    renderer.disableRendering = wasRenderingDisabled;
    
    // Force a render
    if (!wasRenderingDisabled) {
      void renderer.flush();
    }
  }
}

/**
 * Reference to a section of lines in the region that can be updated
 */
export class SectionReference {
  constructor(
    private region: TerminalRegion,
    private startLine: number,
    private height: number
  ) {}

  /**
   * Delete this section - removes the lines from the region
   */
  delete(): void {
    const renderer = this.region.getRenderer();
    const wasRenderingDisabled = renderer.disableRendering;
    renderer.disableRendering = true;

    // Remove lines from explicitlyAddedLines
    this.region.removeRegionLines(this.startLine - 1, this.height);

    // Reduce region height
    this.region.decreaseHeight(this.height);
    renderer.setHeight(this.region.getInternalHeight());

    // Shrink the frame arrays (this also clears previousViewportFrame for recalculation)
    renderer.shrinkFrame(this.startLine - 1, this.height);

    renderer.disableRendering = wasRenderingDisabled;
    
    // Force a render - the viewport frame will be recalculated and show correct content
    if (!wasRenderingDisabled) {
      void renderer.flush();
    }
  }

  /**
   * Update the content of this section
   */
  update(content: string | string[] | LineContent[]): void {
    const renderer = this.region.getRenderer();
    const wasRenderingDisabled = renderer.disableRendering;
    renderer.disableRendering = true;

    let lines: string[] = [];
    if (typeof content === 'string') {
      lines = content.split('\n');
    } else if (Array.isArray(content)) {
      lines = content.map(item => {
        if (typeof item === 'string') {
          return item;
        } else {
          const text = item.text;
          return applyStyle(text, item.style);
        }
      });
    }

    // Update all lines in the section (use provided lines, or empty strings for remaining lines)
    const linesToUpdate = this.height;
    
    // Prepare updates for the renderer
    const updates: Array<{ lineNumber: number; content: string }> = [];
    for (let i = 0; i < linesToUpdate; i++) {
      const lineNumber = this.startLine + i;
      // Use provided line if available, otherwise empty string to clear
      const styled = i < lines.length ? lines[i] : '';
      
      updates.push({ lineNumber, content: styled });
      
      // Track in explicitlyAddedLines
      this.region.ensureExplicitlyAddedLine(this.startLine + i - 1);
      this.region.updateExplicitlyAddedLine(this.startLine + i - 1, {
        content: styled,
        lineNumber: this.startLine + i
      });
    }

    renderer.disableRendering = wasRenderingDisabled;
    
    // Use renderer's method to update lines and schedule render
    // The renderer manages when to actually render (throttling, batching, etc.)
    if (linesToUpdate > 0 && !wasRenderingDisabled) {
      renderer.updateLines(updates);
    }
  }
}

/**
 * TerminalRegion - High-level API for terminal region management
 * 
 * This is the public API that wraps the low-level RegionRenderer.
 * It adds component orchestration, grid layout, and styling support.
 */
export class TerminalRegion {
  private renderer: RegionRenderer;
  private _width: number;
  private _height: number;
  // Track ALL component descriptors that have been set/added, so we can re-render them
  // This is an array of descriptors (or arrays of descriptors for multi-line sections)
  private allComponentDescriptors: any[] = [];
  // Track explicitly added content (prompts, whitespace added via add() or setLine())
  // Components are re-rendered from allComponentDescriptors, so they don't need to be tracked here
  // TODO: With signals, we'll track signal dependencies and re-render only what changed
  private explicitlyAddedLines: Array<{ content: string; lineNumber: number }> = [];
  // Prevent concurrent re-renders (e.g., multiple resize events firing rapidly)
  private isReRendering: boolean = false;

  constructor(options: RegionOptions = {}) {
    this._width = options.width ?? getTerminalWidth();
    this._height = options.height ?? 1;

    // Create the low-level renderer
    const rendererOptions: RegionRendererOptions = {
      stdout: options.stdout,
      disableRendering: options.disableRendering,
      debugLog: options.debugLog,
      // CRITICAL: Pass callback to re-render last content during keep-alive and resize
      // This ensures ALL components (grid) are re-rendered with current width
      // The region orchestrates this - components don't manage their own re-rendering
      onKeepAlive: () => this.reRenderLastContent(),
    };
    
    this.renderer = new RegionRenderer(rendererOptions);
  }

  get width(): number {
    // Sync with renderer width (important for auto-resize)
    this._width = this.renderer.getWidth();
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  getLine(lineNumber: number): string {
    return this.renderer.getLine(lineNumber);
  }

  async getStartRow(): Promise<number | null> {
    return this.renderer.getStartRow();
  }

  showCursorAt(lineNumber: number, column: number): void {
    this.renderer.showCursorAt(lineNumber, column);
  }

  hideCursor(): void {
    this.renderer.hideCursor();
  }

  /**
   * Get the underlying renderer (for internal use by SectionReference)
   * @internal
   */
  getRenderer(): RegionRenderer {
    return this.renderer;
  }

  /**
   * Get the internal height (for internal use by SectionReference)
   * @internal
   */
  getInternalHeight(): number {
    return this._height;
  }

  /**
   * Decrease the region height (for internal use by SectionReference)
   * @internal
   */
  decreaseHeight(amount: number): void {
    this._height = Math.max(0, this._height - amount);
  }

  /**
   * Remove lines from explicitlyAddedLines (for internal use by SectionReference)
   * @internal
   */
  removeRegionLines(startIndex: number, count: number): void {
    this.explicitlyAddedLines.splice(startIndex, count);
  }

  /**
   * Remove a component from allComponentDescriptors (for internal use by ComponentReference)
   * @internal
   */
  removeComponent(componentIndex: number): void {
    if (componentIndex >= 0 && componentIndex < this.allComponentDescriptors.length) {
      this.allComponentDescriptors.splice(componentIndex, 1);
    }
  }

  /**
   * Ensure a region line exists at the given index (for internal use by SectionReference)
   * @internal
   */
  ensureExplicitlyAddedLine(index: number): void {
    while (this.explicitlyAddedLines.length <= index) {
      this.explicitlyAddedLines.push({ content: '', lineNumber: this.explicitlyAddedLines.length + 1 });
    }
  }

  /**
   * Update a region line (for internal use by SectionReference)
   * @internal
   */
  updateExplicitlyAddedLine(index: number, lineInfo: { content: string; lineNumber: number }): void {
    this.explicitlyAddedLines[index] = lineInfo;
  }

  /**
   * Internal method to set a single line (used by components and SectionReference)
   * @internal
   */
  setLineInternal(lineNumber: number, content: string | LineContent): void {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }

    // Update our height tracking if this line is beyond current height
    // BUT respect the expansion limit (max 10 lines beyond current height)
    // This prevents accidental expansion from stray setLine calls
    if (lineNumber > this._height) {
      const maxAllowedHeight = this._height + 10;
      this._height = Math.min(lineNumber, maxAllowedHeight);
    }

    // Extract text and apply styling
    const text = typeof content === 'string' ? content : content.text;
    const styled = applyStyle(text, typeof content === 'object' ? content.style : undefined);

    // Track this line as explicitly added content (via setLine/add)
    // This allows us to preserve it during re-renders
    while (this.explicitlyAddedLines.length < lineNumber) {
      this.explicitlyAddedLines.push({ content: '', lineNumber: this.explicitlyAddedLines.length + 1 });
    }
    this.explicitlyAddedLines[lineNumber - 1] = { 
      content: styled,
      lineNumber 
    };

    // Update the renderer (this will expand the renderer if needed)
    this.renderer.setLine(lineNumber, styled);
    
    // CRITICAL: Sync region height with renderer height after setLine
    // This ensures _height matches renderer.height, preventing height mismatches
    const renderer = this.renderer as any;
    if (renderer.height > this._height) {
      this._height = renderer.height;
    }
  }

  /**
   * @deprecated Use add() which returns a LineReference with update() method
   * Set a single line (1-based line numbers)
   */
  setLine(lineNumber: number, content: string | LineContent): void {
    this.setLineInternal(lineNumber, content);
  }

  /**
   * Set content in the region, replacing all existing content.
   * This always does a full replace - if the new content is the same length,
   * it will overwrite the existing lines. If it's a different length, it will
   * resize the region accordingly.
   */
  set(content: string | LineContent[] | any, ...additionalLines: any[]): void {
    // Check if we have multiple grid descriptors (for multi-line rendering)
    const allContent = additionalLines.length > 0 
      ? [content, ...additionalLines]
      : [content];
    
    // Check if first item is a Component (object with render method or function)
    if (allContent.length > 0 && isComponent(allContent[0])) {
      // Component(s)
      this.allComponentDescriptors = [allContent.length > 1 ? allContent : allContent[0]];
      
      const width = this.width;
      let totalHeight = 0;
      
      const renderer = this.renderer as any;
      const oldHeight = this._height;
      
      // Calculate total height first
      for (const component of allContent) {
        if (isComponent(component)) {
          totalHeight += getComponentHeight(component, this, width);
        }
      }
      
      // FULL REPLACE: Truncate both frames to exact new height
      renderer.pendingFrame = renderer.pendingFrame.slice(0, totalHeight);
      renderer.previousFrame = renderer.previousFrame.slice(0, totalHeight);
      
      while (renderer.pendingFrame.length < totalHeight) {
        renderer.pendingFrame.push('');
      }
      while (renderer.previousFrame.length < totalHeight) {
        renderer.previousFrame.push('');
      }
      
      for (let i = 0; i < totalHeight; i++) {
        renderer.pendingFrame[i] = '';
      }
      
      this._height = totalHeight;
      
      // CRITICAL: set() does a FULL REPLACE, so clear ALL explicitlyAddedLines
      // Components are tracked in allComponentDescriptors and re-rendered from there
      // Any old explicitlyAddedLines entries are stale and should be removed
      this.explicitlyAddedLines = [];
      
      // Don't track component lines in explicitlyAddedLines - they're re-rendered from allComponentDescriptors
      
      // CRITICAL: Disable auto-rendering during component rendering
      // Components call setLine() which triggers scheduleRender(), but we want
      // to batch all updates and render once at the end
      const wasRenderingDisabled = renderer.disableRendering;
      renderer.disableRendering = true;
      
      // Render each component on its line
      // CRITICAL: Write directly to pendingFrame, don't use setLine() which adds to explicitlyAddedLines
      let currentLine = 1;
      for (const component of allContent) {
        if (isComponent(component)) {
          const componentLines = renderComponent(component, this, width);
          // Write component content directly to pendingFrame (don't use setLine which tracks in explicitlyAddedLines)
          for (let i = 0; i < componentLines.length; i++) {
            const lineNumber = currentLine + i;
            const index = lineNumber - 1;
            renderer.ensureFrameSize(index + 1);
            renderer.pendingFrame[index] = componentLines[i];
            if (lineNumber > renderer.height) {
              renderer.height = lineNumber;
            }
          }
          currentLine += componentLines.length;
        }
      }
      
      renderer.setHeight(totalHeight);
      
      if (totalHeight > oldHeight) {
        renderer.expandTo(totalHeight);
      }
      
      // Re-enable rendering and flush once
      renderer.disableRendering = wasRenderingDisabled;
      // Note: flush() is async but we don't await here - caller should await if needed
      void this.renderer.flush();
      return;
    }
    
    

    // Original string/array handling
    if (typeof content === 'string') {
      // Single string with \n line breaks
      const lineCount = content.split('\n').length;
      this._height = lineCount;
      this.renderer.set(content);
    } else if (Array.isArray(content)) {
      // Array of LineContent - apply styling to each
      this._height = content.length;
      const lines = content.map(c => 
        applyStyle(c.text, c.style)
      ).join('\n');
      this.renderer.set(lines);
    }
  }

  /**
   * Add content to the region, appending it after existing content.
   * This is useful for adding multiple sections without overwriting previous content.
   * Returns a SectionReference or ComponentReference that can be used to update/delete the content later.
   */
  add(content: string | LineContent[] | any, ...additionalLines: any[]): SectionReference | ComponentReference {
    // Check if we have multiple grid descriptors
    const allContent = additionalLines.length > 0 
      ? [content, ...additionalLines]
      : [content];
    
    // Check if first item is a Component
    if (allContent.length > 0 && isComponent(allContent[0])) {
      const width = this.width;
      let totalHeight = 0;
      
      // Calculate total height of new content
      const components: Component[] = [];
      for (const item of allContent) {
        if (isComponent(item)) {
          components.push(item);
          totalHeight += getComponentHeight(item, this, width);
        }
      }
      
      const renderer = this.renderer as any;
      const startLine = this._height + 1;
      
      // Extend frames to accommodate new content
      while (renderer.pendingFrame.length < this._height + totalHeight) {
        renderer.pendingFrame.push('');
      }
      // CRITICAL: Only expand previousFrame if we're actually rendering
      // previousFrame should represent what was actually rendered, not what we plan to render
      // If disableRendering=true, we haven't rendered yet, so don't expand previousFrame
      // This prevents false negatives in content-change detection
      if (!renderer.disableRendering) {
        while (renderer.previousFrame.length < this._height + totalHeight) {
          renderer.previousFrame.push('');
        }
      }
      
      // Clear lines where new content will be rendered
      for (let i = 0; i < totalHeight; i++) {
        renderer.pendingFrame[this._height + i] = '';
      }
      
      // Don't track component lines in regionLines - they're re-rendered from allComponentDescriptors
      
      // Track this new content
      const descriptorsToAdd = allContent.length > 1 ? allContent : allContent[0];
      const componentIndex = this.allComponentDescriptors.length;
      this.allComponentDescriptors.push(descriptorsToAdd);
      
      // Update region height BEFORE rendering
      this._height += totalHeight;
      renderer.setHeight(this._height);
      
      // Expand region to accommodate new content
      renderer.expandTo(this._height);
      
      // CRITICAL: Disable auto-rendering during component rendering
      // Components call setLine() which triggers scheduleRender(), but we want
      // to batch all updates and render once at the end
      const wasRenderingDisabled = renderer.disableRendering;
      renderer.disableRendering = true;
      
      // Render each component starting from startLine
      let currentLine = startLine;
      for (const component of components) {
        const height = getComponentHeight(component, this, width);
        const componentLines = renderComponent(component, this, width);
        // Write component content to pendingFrame at the correct position
        for (let i = 0; i < componentLines.length; i++) {
          const lineNumber = currentLine + i;
          const index = lineNumber - 1;
          renderer.ensureFrameSize(index + 1);
          renderer.pendingFrame[index] = componentLines[i];
          if (lineNumber > renderer.height) {
            renderer.height = lineNumber;
          }
        }
        currentLine += height;
      }
      
      // Re-enable rendering and flush once
      renderer.disableRendering = wasRenderingDisabled;
      // Note: flush() is async but we don't await here - caller should await if needed
      void this.renderer.flush();
      return new ComponentReference(this, componentIndex, totalHeight);
    }
    
    // Single Component (object with render method or function)
    if (isComponent(content)) {
      const width = this.width;
      const height = getComponentHeight(content, this, width);
      const startLine = this._height + 1;
      
      const renderer = this.renderer as any;
      
      // Extend frames
      while (renderer.pendingFrame.length < this._height + height) {
        renderer.pendingFrame.push('');
      }
      // CRITICAL: Only expand previousFrame if we're actually rendering
      // previousFrame should represent what was actually rendered, not what we plan to render
      // If disableRendering=true, we haven't rendered yet, so don't expand previousFrame
      // This prevents false negatives in content-change detection
      if (!renderer.disableRendering) {
        while (renderer.previousFrame.length < this._height + height) {
          renderer.previousFrame.push('');
        }
      }
      
      // Clear lines where new content will be rendered
      for (let i = 0; i < height; i++) {
        renderer.pendingFrame[this._height + i] = '';
      }
      
      // Don't track component lines in regionLines - they're re-rendered from allComponentDescriptors
      
      // Track this new content
      const componentIndex = this.allComponentDescriptors.length;
      this.allComponentDescriptors.push(content);
      
      // Update region height BEFORE rendering
      this._height += height;
      renderer.setHeight(this._height);
      
      // Expand region to accommodate new content
      renderer.expandTo(this._height);
      
      // CRITICAL: Disable auto-rendering during component rendering
      const wasRenderingDisabled = renderer.disableRendering;
      renderer.disableRendering = true;
      
      // Render component (renderComponent will set up onUpdate callback)
      const componentLines = renderComponent(content, this, width);
      // Write component content to pendingFrame at the correct position
      for (let i = 0; i < componentLines.length; i++) {
        const lineNumber = startLine + i;
        const index = lineNumber - 1;
        renderer.ensureFrameSize(index + 1);
        renderer.pendingFrame[index] = componentLines[i];
        if (lineNumber > renderer.height) {
          renderer.height = lineNumber;
        }
      }
      
      // Re-enable rendering and flush once
      renderer.disableRendering = wasRenderingDisabled;
      // Note: flush() is async but we don't await here - caller should await if needed
      void this.renderer.flush();
      return new ComponentReference(this, componentIndex, height);
    }

    // String/array handling - append after existing content
    if (typeof content === 'string') {
      const lines = content.split('\n');
      const startLine = this._height + 1;
      
      // CRITICAL: Directly update pendingFrame without scheduling renders
      // We don't want add() to trigger any rendering - only update() should render
      const renderer = this.renderer as any;
      const wasRenderingDisabled = renderer.disableRendering;
      renderer.disableRendering = true;
      
      // Expand renderer if needed
      const endLine = startLine + lines.length - 1;
      if (endLine > renderer.height) {
        renderer.expandTo(endLine);
        renderer.height = endLine;
      }
      
      // Directly update pendingFrame without going through setLine() (which schedules renders)
      for (let i = 0; i < lines.length; i++) {
        const lineIndex = startLine + i - 1;
        while (renderer.pendingFrame.length <= lineIndex) {
          renderer.pendingFrame.push('');
        }
        renderer.pendingFrame[lineIndex] = lines[i];
        
      // Track in explicitlyAddedLines
      while (this.regionLines.length < startLine + i) {
        this.regionLines.push({ content: '', lineNumber: this.regionLines.length + 1 });
      }
      this.regionLines[startLine + i - 1] = {
        content: lines[i],
        lineNumber: startLine + i
      };
      }
      
      // Update region height tracking
      this._height = endLine;
      
      // Re-enable rendering (but don't flush - let caller decide when to render)
      // The update() method will handle flushing when ready
      renderer.disableRendering = wasRenderingDisabled;
      return new SectionReference(this, startLine, lines.length);
    } else if (Array.isArray(content)) {
      // CRITICAL: Check if region is effectively empty (no content has been set yet)
      // If so, start from line 1 instead of appending after height
      const renderer = this.renderer as any;
      // Region is empty if:
      // 1. Height is 0, OR
      // 2. All lines in pendingFrame are empty strings (no content set yet)
      const isEmpty = this._height === 0 || 
        (renderer.pendingFrame && renderer.pendingFrame.length > 0 && 
         renderer.pendingFrame.every((line: string) => !line || line.trim() === ''));
      
      const startLine = isEmpty ? 1 : this._height + 1;
      
      // CRITICAL: Directly update pendingFrame without scheduling renders
      // We don't want add() to trigger any rendering - only update() should render
      const wasRenderingDisabled = renderer.disableRendering;
      renderer.disableRendering = true;
      
      // Expand renderer if needed
      const endLine = startLine + content.length - 1;
      if (endLine > renderer.height) {
        renderer.expandTo(endLine);
        renderer.height = endLine;
      }
      
      // Directly update pendingFrame without going through setLine() (which schedules renders)
      for (let i = 0; i < content.length; i++) {
        const lineIndex = startLine + i - 1;
        const lineContent = String(content[i]);
        while (renderer.pendingFrame.length <= lineIndex) {
          renderer.pendingFrame.push('');
        }
        renderer.pendingFrame[lineIndex] = lineContent;
        
        // Track in explicitlyAddedLines
        while (this.explicitlyAddedLines.length < startLine + i) {
          this.explicitlyAddedLines.push({ content: '', lineNumber: this.explicitlyAddedLines.length + 1 });
        }
        this.explicitlyAddedLines[startLine + i - 1] = {
          content: lineContent,
          lineNumber: startLine + i
        };
      }
      
      // Update region height tracking
      this._height = Math.max(this._height, endLine);
      
      // Re-enable rendering (but don't flush - let caller decide when to render)
      // The update() method will handle flushing when ready
      renderer.disableRendering = wasRenderingDisabled;
      return new SectionReference(this, startLine, content.length);
    }
    
    // Fallback: return empty section reference (shouldn't happen)
    return new SectionReference(this, this._height + 1, 0);
  }


  clearLine(lineNumber: number): void {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }
    this.renderer.clearLine(lineNumber);
  }

  clear(): void {
    this.renderer.clear();
  }

  async flush(): Promise<void> {
    // Force immediate render of any pending updates (bypasses throttle)
    // Returns a promise that resolves when rendering is complete
    await this.renderer.flush();
  }

  /**
   * Re-render the last content that was set
   * This re-renders all components (grid) with the current width
   * Used by resize handler and keep-alive to prevent auto-reflow
   * The region orchestrates this - components don't manage their own re-rendering
   * 
   * CRITICAL: Re-renders the entire region, including:
   * - Component lines (grid)
   * - Static lines (waitForSpacebar, whitespace)
   * This ensures everything is in the correct position
   */
  reRenderLastContent(): void {
    // CRITICAL: Prevent concurrent re-renders
    // If we're already re-rendering, skip this call to prevent duplicates
    if (this.isReRendering) {
      const renderer = this.renderer as any;
      renderer.logToFile(`[reRenderLastContent] SKIPPED: already re-rendering`);
      return;
    }
    
    if (this.allComponentDescriptors.length > 0) {
      this.isReRendering = true;
      
      try {
        const renderer = this.renderer as any;
        // CRITICAL: Read width AFTER setting isReRendering to ensure we get the latest value
        // The width getter syncs with renderer.getWidth() which should have the updated width from resize
      const width = this.width;
        renderer.logToFile(`[reRenderLastContent] CALLED: height=${this._height} width=${width} lastRenderedHeight=${renderer.lastRenderedHeight}`);
      
      // First, calculate total height of ALL content (components + static lines)
      let totalHeight = 0;
      for (const itemOrArray of this.allComponentDescriptors) {
        const items = Array.isArray(itemOrArray) ? itemOrArray : [itemOrArray];
        
        for (const item of items) {
          if (isComponent(item)) {
            totalHeight += getComponentHeight(item, this, width);
          }
        }
      }
      
      // CRITICAL: Include static lines (waitForSpacebar, whitespace) in total height
      // Count how many static lines exist beyond the component height
      let maxExplicitLineNumber = 0;
      for (let i = 0; i < this.explicitlyAddedLines.length; i++) {
        const lineInfo = this.explicitlyAddedLines[i];
        if (lineInfo.content) {
          maxExplicitLineNumber = Math.max(maxExplicitLineNumber, lineInfo.lineNumber);
        }
      }
      // totalHeight should be at least as large as the highest explicitly added line number
      totalHeight = Math.max(totalHeight, maxExplicitLineNumber);
      
      // CRITICAL: Collect explicitly added lines BEFORE sizing frames, so we know the final height
      // explicitlyAddedLines ONLY contains explicitly added content (prompts, etc.)
      // Components are re-rendered from allComponentDescriptors, so they're not tracked here
      // TODO: With signals, we'll track signal dependencies and re-render only what changed
      const explicitlyAddedLines: Array<{ originalLineNumber: number; content: string }> = [];
      
      // CRITICAL: Collect ALL explicitly added lines that have content
      // We'll render them AFTER all components, regardless of their original line numbers
      // The original line numbers are just for preserving order, not for filtering
      // This ensures prompts and other explicitly added content always appear at the end
      for (let i = 0; i < this.explicitlyAddedLines.length; i++) {
        const lineInfo = this.explicitlyAddedLines[i];
        if (lineInfo.content && lineInfo.content.trim() !== '') {
          explicitlyAddedLines.push({
            originalLineNumber: lineInfo.lineNumber,
            content: lineInfo.content,
          });
          renderer.logToFile(`[reRenderLastContent] Found explicitly added line at index ${i} (original line ${lineInfo.lineNumber}): "${lineInfo.content.substring(0, 40)}"`);
        }
      }
      
      // Sort explicitly added lines by original line number to preserve order
      explicitlyAddedLines.sort((a, b) => a.originalLineNumber - b.originalLineNumber);
      
      renderer.logToFile(`[reRenderLastContent] Collected ${explicitlyAddedLines.length} explicitly added lines (will render after components)`);
      
      // Calculate final height: components + explicitly added lines
      const estimatedFinalHeight = totalHeight + explicitlyAddedLines.length;
      
      // CRITICAL: Ensure frames are the correct size BEFORE re-rendering
      // Use estimated final height to avoid truncating static lines
      while (renderer.pendingFrame.length < estimatedFinalHeight) {
        renderer.pendingFrame.push('');
      }
      while (renderer.previousFrame.length < estimatedFinalHeight) {
        renderer.previousFrame.push('');
      }
      
      // Don't truncate frames - we'll expand as needed when rendering static lines
      
      // CRITICAL: Don't clear previousFrame on resize/re-render
      // We need to preserve previousFrame so renderNow() can detect if content actually changed
      // If we clear it, renderNow() will always think content changed and re-render unnecessarily
      // The previousFrame will be updated after renderNow() completes
      
      // CRITICAL: Clear all lines before re-rendering
      // We need to clear the ENTIRE pendingFrame, not just up to totalHeight,
      // because old content might be beyond totalHeight and cause corruption
      renderer.logToFile(`[reRenderLastContent] BEFORE CLEAR: pendingFrame.length=${renderer.pendingFrame.length}, first 5 lines:`);
      for (let i = 0; i < Math.min(5, renderer.pendingFrame.length); i++) {
        renderer.logToFile(`[reRenderLastContent]   [${i}]: "${renderer.pendingFrame[i].substring(0, 50)}"`);
      }
      
      for (let i = 0; i < renderer.pendingFrame.length; i++) {
        renderer.pendingFrame[i] = '';
      }
      // Also ensure pendingFrame is exactly the right size
      renderer.pendingFrame = renderer.pendingFrame.slice(0, estimatedFinalHeight);
      while (renderer.pendingFrame.length < estimatedFinalHeight) {
        renderer.pendingFrame.push('');
      }
      
      renderer.logToFile(`[reRenderLastContent] AFTER CLEAR: pendingFrame.length=${renderer.pendingFrame.length}, estimatedFinalHeight=${estimatedFinalHeight}`);
      
      // CRITICAL: Disable auto-rendering during component rendering
      // Components call setLine() which triggers scheduleRender(), but we want
      // to batch all updates and render once at the end
      const wasRenderingDisabled = renderer.disableRendering;
      renderer.disableRendering = true;
      
      // Now re-render ALL components starting from line 1
      let currentLine = 1;
      renderer.logToFile(`[reRenderLastContent] Re-rendering ${this.allComponentDescriptors.length} component descriptor(s)`);
      for (let descIdx = 0; descIdx < this.allComponentDescriptors.length; descIdx++) {
        const itemOrArray = this.allComponentDescriptors[descIdx];
        // Each entry can be a single component or an array of components (for multi-line sections)
        const items = Array.isArray(itemOrArray) ? itemOrArray : [itemOrArray];
        
        renderer.logToFile(`[reRenderLastContent] Descriptor ${descIdx}: ${items.length} item(s), starting at line ${currentLine}`);
        
        // Re-render each component in this section
        for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
          const item = items[itemIdx];
          if (isComponent(item)) {
            const componentHeight = getComponentHeight(item, this, width);
            
            renderer.logToFile(`[reRenderLastContent] Rendering component ${itemIdx} at line ${currentLine}, height=${componentHeight}`);
            
            // Render component (pure - just returns content)
            const componentLines = renderComponent(item, this, width);
            
            // Write component content to pendingFrame at the correct position
            for (let i = 0; i < componentLines.length; i++) {
              const lineNumber = currentLine + i;
              const index = lineNumber - 1;
              renderer.ensureFrameSize(index + 1);
              
              // DEBUG: Log what we're writing and where
              const oldContent = renderer.pendingFrame[index] ? renderer.pendingFrame[index].substring(0, 40) : '(empty)';
              const newContent = componentLines[i].substring(0, 40);
              if (oldContent !== newContent && oldContent !== '(empty)') {
                renderer.logToFile(`[reRenderLastContent] WARNING: Overwriting component line ${lineNumber} (index ${index}) - old: "${oldContent}", new: "${newContent}"`);
              } else {
                renderer.logToFile(`[reRenderLastContent] Writing component line ${lineNumber} (index ${index}): "${newContent}"`);
              }
              
              renderer.pendingFrame[index] = componentLines[i];
              if (lineNumber > renderer.height) {
                renderer.height = lineNumber;
              }
            }
            
            // Move to next line
            currentLine += componentHeight;
          }
        }
      }
      
      renderer.logToFile(`[reRenderLastContent] Finished rendering components, currentLine=${currentLine}`);
      
      // DEBUG: Log pendingFrame state after component rendering
      renderer.logToFile(`[reRenderLastContent] AFTER COMPONENT RENDER: pendingFrame.length=${renderer.pendingFrame.length}`);
      for (let i = 0; i < Math.min(10, renderer.pendingFrame.length); i++) {
        const content = renderer.pendingFrame[i] ? renderer.pendingFrame[i].substring(0, 50) : '(empty)';
        renderer.logToFile(`[reRenderLastContent]   [${i}] (line ${i + 1}): "${content}"`);
      }
      
      // After re-rendering components, re-render explicitly added lines
      // Explicitly added lines should come AFTER all components
      // (explicitlyAddedLines was already collected above)
      
      // Re-render explicitly added lines starting after all components
      // currentLine is where the last component ended, so explicitly added lines start there
      let explicitLinePosition = currentLine;
      renderer.logToFile(`[reRenderLastContent] Re-rendering ${explicitlyAddedLines.length} explicitly added lines starting at line ${explicitLinePosition}`);
      for (const explicitLine of explicitlyAddedLines) {
        // Ensure pendingFrame has enough lines
        while (renderer.pendingFrame.length < explicitLinePosition) {
          renderer.pendingFrame.push('');
        }
        const index = explicitLinePosition - 1;
        const oldContent = renderer.pendingFrame[index] ? renderer.pendingFrame[index].substring(0, 40) : '(empty)';
        const newContent = explicitLine.content.substring(0, 40);
        if (oldContent !== newContent && oldContent !== '(empty)') {
          renderer.logToFile(`[reRenderLastContent] WARNING: Overwriting explicitly added line ${explicitLinePosition} (index ${index}, original ${explicitLine.originalLineNumber}) - old: "${oldContent}", new: "${newContent}"`);
        } else {
          renderer.logToFile(`[reRenderLastContent] Writing explicitly added line ${explicitLinePosition} (index ${index}, original ${explicitLine.originalLineNumber}): "${newContent}"`);
        }
        renderer.pendingFrame[index] = explicitLine.content;
        explicitLinePosition++;
      }
      
      // DEBUG: Log pendingFrame state after explicitly added line rendering
      renderer.logToFile(`[reRenderLastContent] AFTER EXPLICITLY ADDED LINES: pendingFrame.length=${renderer.pendingFrame.length}`);
      for (let i = 0; i < Math.min(10, renderer.pendingFrame.length); i++) {
        const content = renderer.pendingFrame[i] ? renderer.pendingFrame[i].substring(0, 50) : '(empty)';
        renderer.logToFile(`[reRenderLastContent]   [${i}] (line ${i + 1}): "${content}"`);
      }
      
      // Update total height to include explicitly added lines
      const finalHeight = Math.max(totalHeight, explicitLinePosition - 1);
      
      // Update explicitlyAddedLines to reflect new positions
      // Only track explicitly added lines - components are re-rendered from allComponentDescriptors
      this.explicitlyAddedLines = [];
      
      // Add explicitly added lines at their new positions (after all components)
      let newExplicitLinePosition = currentLine;
      for (const explicitLine of explicitlyAddedLines) {
        this.explicitlyAddedLines.push({
          content: explicitLine.content,
          lineNumber: newExplicitLinePosition,
        });
        newExplicitLinePosition++;
      }
      
      // Update height to match all rendered content (components + static lines)
      const oldHeight = this._height;
      this._height = finalHeight;
      renderer.setHeight(finalHeight);
      
      // CRITICAL: If content height changed significantly, reset previousViewportFrame
      // This prevents the diff algorithm from comparing mismatched viewport positions
      // When content wraps/unwraps, the viewport shows different logical lines,
      // so we need a fresh diff comparison
      if (Math.abs(finalHeight - oldHeight) > 0) {
        const rendererInternal = renderer as any;
        // Reset previousViewportFrame to force full redraw with correct viewport positioning
        rendererInternal.previousViewportFrame = [];
        rendererInternal.lastRenderedHeight = 0;
      }
      
      // CRITICAL: DON'T update lastRenderedHeight before flushing
      // This would change the state and make renderNow() think height hasn't increased
      // when it actually has. Let renderNow() update lastRenderedHeight after rendering.
      // This keeps the state consistent with the normal set() path
      const oldLastRenderedHeight = renderer.lastRenderedHeight;
      renderer.logToFile(`[reRenderLastContent] BEFORE flush: height=${finalHeight} oldHeight=${oldHeight} lastRenderedHeight=${oldLastRenderedHeight} explicitlyAddedLines=${explicitlyAddedLines.length}`);
      
      // Re-enable rendering and flush once
      renderer.disableRendering = wasRenderingDisabled;
      this.renderer.flush();
      } finally {
        this.isReRendering = false;
      }
    }
  }

  setThrottle(fps: number): void {
    // Note: setThrottleFps doesn't exist on native region, removing for now
    // this.region.setThrottleFps(fps);
  }

  async destroy(clearFirst: boolean = false): Promise<void> {
    await this.renderer.destroy(clearFirst);
  }
}

