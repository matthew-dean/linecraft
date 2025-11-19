import { RegionRenderer, type RegionRendererOptions } from './native/region-renderer';
import { applyStyle } from './utils/colors';
import { getTerminalWidth } from './utils/terminal';
import type { RegionOptions, LineContent } from './types';
import type { Component } from './layout/grid';

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
 * Render a component to the region at the specified position
 */
function renderComponent(component: Component, region: TerminalRegion, x: number, y: number, width: number): void {
  const ctx = {
    availableWidth: width,
    region: region,
    columnIndex: x,
    rowIndex: y,
  };
  const result = typeof component === 'function' ? component(ctx) : component.render(ctx);
  
  if (result === null) return;
  
  if (Array.isArray(result)) {
    for (let i = 0; i < result.length; i++) {
      region.setLine(y + i, result[i]);
    }
  } else {
    region.setLine(y, result);
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
   * Update the content of this section
   */
  update(content: string | string[] | LineContent[]): void {
    const renderer = (this.region as any).renderer;
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

    const linesToUpdate = Math.min(lines.length, this.height);
    
    // Prepare updates for the renderer
    const updates: Array<{ lineNumber: number; content: string }> = [];
    for (let i = 0; i < linesToUpdate; i++) {
      const lineNumber = this.startLine + i;
      const styled = lines[i];
      
      updates.push({ lineNumber, content: styled });
      
      // Track in regionLines
      const region = this.region as any;
      while (region.regionLines.length < this.startLine + i) {
        region.regionLines.push({ type: 'static', lineNumber: region.regionLines.length + 1 });
      }
      region.regionLines[this.startLine + i - 1] = {
        type: 'static',
        content: styled,
        lineNumber: this.startLine + i
      };
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
  // Track all lines in the region (component + waitForSpacebar + any whitespace)
  // This allows us to re-render the entire region correctly
  private regionLines: Array<{ type: 'component' | 'static', content?: any, lineNumber: number }> = [];
  // Prevent concurrent re-renders (e.g., multiple resize events firing rapidly)
  private isReRendering: boolean = false;

  constructor(options: RegionOptions = {}) {
    this._width = options.width ?? getTerminalWidth();
    this._height = options.height ?? 1;

    // Create the low-level renderer
    const rendererOptions: RegionRendererOptions = {
      stdout: options.stdout,
      disableRendering: options.disableRendering,
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

    // CRITICAL: Track this line as static content (not part of component)
    // This allows us to preserve it during re-renders
    while (this.regionLines.length < lineNumber) {
      this.regionLines.push({ type: 'static', lineNumber: this.regionLines.length + 1 });
    }
    this.regionLines[lineNumber - 1] = { 
      type: 'static', 
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
    const isComponent = (item: any): item is Component => {
      return item !== null && (
        typeof item === 'function' ||
        (typeof item === 'object' && 'render' in item && typeof item.render === 'function')
      );
    };
    
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
      this.regionLines = [];
      for (let i = 0; i < totalHeight; i++) {
        this.regionLines[i] = { type: 'component', lineNumber: i + 1 };
      }
      
      // CRITICAL: Disable auto-rendering during component rendering
      // Components call setLine() which triggers scheduleRender(), but we want
      // to batch all updates and render once at the end
      const wasRenderingDisabled = renderer.disableRendering;
      renderer.disableRendering = true;
      
      // Render each component on its line
      let currentLine = 1;
      for (const component of allContent) {
        if (isComponent(component)) {
          const ctx = {
            availableWidth: width,
            region: this,
            columnIndex: 0,
            rowIndex: currentLine,
          };
          const result = typeof component === 'function' ? component(ctx) : component.render(ctx);
          
          if (result !== null) {
            const height = Array.isArray(result) ? result.length : 1;
            if (Array.isArray(result)) {
              for (let i = 0; i < result.length; i++) {
                this.setLine(currentLine + i, result[i]);
              }
            } else {
              this.setLine(currentLine, result);
            }
            currentLine += height;
          }
        }
      }
      
      (renderer as any).height = totalHeight;
      
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
   * Returns a SectionReference that can be used to update the content later.
   */
  add(content: string | LineContent[] | any, ...additionalLines: any[]): SectionReference {
    // Check if we have multiple grid descriptors
    const allContent = additionalLines.length > 0 
      ? [content, ...additionalLines]
      : [content];
    
    // Check if first item is a Component
    const isComponent = (item: any): item is Component => {
      return item !== null && (
        typeof item === 'function' ||
        (typeof item === 'object' && 'render' in item && typeof item.render === 'function')
      );
    };
    
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
      
      // Update regionLines
      for (let i = 0; i < totalHeight; i++) {
        this.regionLines.push({ type: 'component', lineNumber: this._height + i + 1 });
      }
      
      // Track this new content
      const descriptorsToAdd = allContent.length > 1 ? allContent : allContent[0];
      this.allComponentDescriptors.push(descriptorsToAdd);
      
      // Update region height BEFORE rendering
      this._height += totalHeight;
      (renderer as any).height = this._height;
      
      // Expand region to accommodate new content
      renderer.expandTo(this._height);
      
      // CRITICAL: Disable auto-rendering during component rendering
      // Components call setLine() which triggers scheduleRender(), but we want
      // to batch all updates and render once at the end
      const wasRenderingDisabled = renderer.disableRendering;
      renderer.disableRendering = true;
      
      // Render each component starting from startLine
      let currentLine = startLine;
      for (const component of resolvedComponents) {
        const height = getComponentHeight(component, this, width);
        renderComponent(component, this, 0, currentLine, width);
        currentLine += height;
      }
      
      // Re-enable rendering and flush once
      renderer.disableRendering = wasRenderingDisabled;
      // Note: flush() is async but we don't await here - caller should await if needed
      void this.renderer.flush();
      return new SectionReference(this, startLine, totalHeight);
    }
    
    // Single Component (object with render method or function)
    const isComponent = (item: any): item is Component => {
      return item !== null && (
        typeof item === 'function' ||
        (typeof item === 'object' && 'render' in item && typeof item.render === 'function')
      );
    };
    
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
      
      // Update regionLines
      for (let i = 0; i < height; i++) {
        this.regionLines.push({ type: 'component', lineNumber: this._height + i + 1 });
      }
      
      // Track this new content
      this.allComponentDescriptors.push(content);
      
      // Update region height BEFORE rendering
      this._height += height;
      (renderer as any).height = this._height;
      
      // Expand region to accommodate new content
      renderer.expandTo(this._height);
      
      // CRITICAL: Disable auto-rendering during component rendering
      const wasRenderingDisabled = renderer.disableRendering;
      renderer.disableRendering = true;
      
      // Render component
      renderComponent(content, this, 0, startLine, width);
      
      // Re-enable rendering and flush once
      renderer.disableRendering = wasRenderingDisabled;
      // Note: flush() is async but we don't await here - caller should await if needed
      void this.renderer.flush();
      return new SectionReference(this, startLine, height);
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
        
        // Track in regionLines
        while (this.regionLines.length < startLine + i) {
          this.regionLines.push({ type: 'static', lineNumber: this.regionLines.length + 1 });
        }
        this.regionLines[startLine + i - 1] = {
          type: 'static',
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
        
        // Track in regionLines
        while (this.regionLines.length < startLine + i) {
          this.regionLines.push({ type: 'static', lineNumber: this.regionLines.length + 1 });
        }
        this.regionLines[startLine + i - 1] = {
          type: 'static',
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
      const isComponent = (item: any): item is Component => {
        return item !== null && (
          typeof item === 'function' ||
          (typeof item === 'object' && 'render' in item && typeof item.render === 'function')
        );
      };
      
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
      let maxStaticLineNumber = 0;
      for (let i = 0; i < this.regionLines.length; i++) {
        const lineInfo = this.regionLines[i];
        if (lineInfo.type === 'static' && lineInfo.content !== undefined) {
          maxStaticLineNumber = Math.max(maxStaticLineNumber, lineInfo.lineNumber);
        }
      }
      // totalHeight should be at least as large as the highest static line number
      totalHeight = Math.max(totalHeight, maxStaticLineNumber);
      
      // CRITICAL: Ensure frames are the correct size BEFORE re-rendering
      // This prevents overwriting or truncating content incorrectly
      while (renderer.pendingFrame.length < totalHeight) {
        renderer.pendingFrame.push('');
      }
      while (renderer.previousFrame.length < totalHeight) {
        renderer.previousFrame.push('');
      }
      
      // Truncate frames to exact height (in case they're too large)
      renderer.pendingFrame = renderer.pendingFrame.slice(0, totalHeight);
      renderer.previousFrame = renderer.previousFrame.slice(0, totalHeight);
      
      // CRITICAL: Don't clear previousFrame on resize/re-render
      // We need to preserve previousFrame so renderNow() can detect if content actually changed
      // If we clear it, renderNow() will always think content changed and re-render unnecessarily
      // The previousFrame will be updated after renderNow() completes
      
      // Clear all lines before re-rendering
      for (let i = 0; i < totalHeight; i++) {
        renderer.pendingFrame[i] = '';
      }
      
      // CRITICAL: Disable auto-rendering during component rendering
      // Components call setLine() which triggers scheduleRender(), but we want
      // to batch all updates and render once at the end
      const wasRenderingDisabled = renderer.disableRendering;
      renderer.disableRendering = true;
      
      // Now re-render ALL components starting from line 1
      let currentLine = 1;
      for (const itemOrArray of this.allComponentDescriptors) {
        // Each entry can be a single component or an array of components (for multi-line sections)
        const items = Array.isArray(itemOrArray) ? itemOrArray : [itemOrArray];
        
        // Re-render each component in this section
        for (const item of items) {
          if (isComponent(item)) {
            const componentHeight = getComponentHeight(item, this, width);
            
            // Render component at current line
            renderComponent(item, this, 0, currentLine, width);
            
            // Move to next line
            currentLine += componentHeight;
          }
        }
      }
      
      // Update height to match all rendered content
      this._height = totalHeight;
      (renderer as any).height = totalHeight;
      
      // CRITICAL: DON'T update lastRenderedHeight before flushing
      // This would change the state and make renderNow() think height hasn't increased
      // when it actually has. Let renderNow() update lastRenderedHeight after rendering.
      // This keeps the state consistent with the normal set() path
      const oldLastRenderedHeight = (renderer as any).lastRenderedHeight;
      renderer.logToFile(`[reRenderLastContent] BEFORE flush: height=${totalHeight} lastRenderedHeight=${oldLastRenderedHeight}`);
      
      // CRITICAL: Re-render static lines (waitForSpacebar, whitespace)
      // These are tracked in regionLines with type 'static'
      for (let i = 0; i < this.regionLines.length; i++) {
        const lineInfo = this.regionLines[i];
        if (lineInfo.type === 'static' && lineInfo.content !== undefined) {
          // Re-render this static line
          const lineNumber = i + 1;
          // Ensure pendingFrame has enough lines
          while (renderer.pendingFrame.length < lineNumber) {
            renderer.pendingFrame.push('');
          }
          renderer.pendingFrame[lineNumber - 1] = lineInfo.content;
        }
      }
      
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

