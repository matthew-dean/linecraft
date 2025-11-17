import { RegionRenderer, type RegionRendererOptions } from './native/region-renderer';
import { applyStyle } from './utils/colors';
import { getTerminalWidth } from './utils/terminal';
import type { RegionOptions, LineContent } from './types';
import { resolveGrid, type GridDescriptor } from './api/grid';
import { type GridComponent } from './layout/grid';

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
    // Only pass width if it was explicitly set by the user (to allow auto-resize)
    const rendererOptions: RegionRendererOptions = {
      height: this._height,
      stdout: options.stdout,
      disableRendering: options.disableRendering,
      // CRITICAL: Pass callback to re-render last content during keep-alive and resize
      // This ensures ALL components (grid) are re-rendered with current width
      // The region orchestrates this - components don't manage their own re-rendering
      onKeepAlive: () => this.reRenderLastContent(),
    };
    
    // Only set width if user explicitly provided it (allows auto-resize to work)
    if (options.width !== undefined) {
      rendererOptions.width = options.width;
    }
    
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

  /**
   * Set a single line (1-based line numbers)
   * 
   * Note: With auto-wrap disabled globally, we manage all wrapping ourselves.
   * This method sets a single line - if content needs to wrap, it should
   * be handled by the component layer (grid, style, etc.) before calling this.
   * Content that exceeds the region width will be truncated by the terminal.
   * 
   * The region will automatically expand if lineNumber exceeds current height.
   */
  setLine(lineNumber: number, content: string | LineContent): void {
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
    
    // Check if first item is a grid descriptor
    if (allContent.length > 0 && typeof allContent[0] === 'object' && allContent[0] !== null && 'type' in allContent[0] && allContent[0].type === 'grid') {
      // Grid descriptor(s)
      this.allComponentDescriptors = [allContent.length > 1 ? allContent : allContent[0]];
      
      const width = this.width;
      let totalHeight = 0;
      
      const renderer = this.renderer as any;
      const oldHeight = this._height;
      
      // Calculate total height first
      for (const descriptor of allContent) {
        if (descriptor.type === 'grid') {
          const component = resolveGrid(this, descriptor);
          totalHeight += component.getHeight();
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
      for (const descriptor of allContent) {
        if (descriptor.type === 'grid') {
          const component = resolveGrid(this, descriptor);
          const height = component.getHeight();
          
          component.render(0, currentLine, width);
          
          currentLine += height;
        }
      }
      
      (renderer as any).height = totalHeight;
      
      if (totalHeight > oldHeight) {
        renderer.expandTo(totalHeight);
      }
      
      // Re-enable rendering and flush once
      renderer.disableRendering = wasRenderingDisabled;
      this.renderer.flush();
      return;
    }
    
    // Single grid descriptor
    if (typeof content === 'object' && content !== null && 'type' in content && content.type === 'grid') {
      this.allComponentDescriptors = [content];
      
      const component = resolveGrid(this, content);
      const width = this.width;
      const height = component.getHeight();
      
      const renderer = this.renderer as any;
      const oldHeight = this._height;
      
      renderer.pendingFrame = renderer.pendingFrame.slice(0, height);
      renderer.previousFrame = renderer.previousFrame.slice(0, height);
      
      while (renderer.pendingFrame.length < height) {
        renderer.pendingFrame.push('');
      }
      while (renderer.previousFrame.length < height) {
        renderer.previousFrame.push('');
      }
      
      for (let i = 0; i < height; i++) {
        renderer.pendingFrame[i] = '';
      }
      
      this._height = height;
      this.regionLines = [];
      for (let i = 0; i < height; i++) {
        this.regionLines[i] = { type: 'component', lineNumber: i + 1 };
      }
      
      (renderer as any).height = height;
      
      if (height > oldHeight) {
        renderer.expandTo(height);
      }
      
      // CRITICAL: Disable auto-rendering during component rendering
      const wasRenderingDisabled = renderer.disableRendering;
      renderer.disableRendering = true;
      
      component.render(0, 1, width);
      
      if (renderer.pendingFrame.length > height) {
        renderer.pendingFrame = renderer.pendingFrame.slice(0, height);
      }
      
      // Re-enable rendering and flush once
      renderer.disableRendering = wasRenderingDisabled;
      this.renderer.flush();
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
   */
  add(content: string | LineContent[] | any, ...additionalLines: any[]): void {
    // Check if we have multiple grid descriptors
    const allContent = additionalLines.length > 0 
      ? [content, ...additionalLines]
      : [content];
    
    // Check if first item is a grid descriptor
    if (allContent.length > 0 && typeof allContent[0] === 'object' && allContent[0] !== null && 'type' in allContent[0] && allContent[0].type === 'grid') {
      const width = this.width;
      let totalHeight = 0;
      
      // Calculate total height of new content
      const resolvedComponents: GridComponent[] = [];
      for (const descriptor of allContent) {
        if (descriptor.type === 'grid') {
          const component = resolveGrid(this, descriptor);
          resolvedComponents.push(component);
          totalHeight += component.getHeight();
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
        const height = component.getHeight();
        component.render(0, currentLine, width);
        currentLine += height;
      }
      
      // Re-enable rendering and flush once
      renderer.disableRendering = wasRenderingDisabled;
      this.renderer.flush();
      return;
    }
    
    // Single grid descriptor
    if (typeof content === 'object' && content !== null && 'type' in content && content.type === 'grid') {
      const component = resolveGrid(this, content);
      const width = this.width;
      const height = component.getHeight();
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
      component.render(0, startLine, width);
      
      // Re-enable rendering and flush once
      renderer.disableRendering = wasRenderingDisabled;
      this.renderer.flush();
      return;
    }

    // String/array handling - append after existing content
    if (typeof content === 'string') {
      const lines = content.split('\n');
      const startLine = this._height + 1;
      
      // CRITICAL: Disable auto-rendering during line setting to batch updates
      // setLine() will expand the region automatically, but we want to batch renders
      const renderer = this.renderer as any;
      const wasRenderingDisabled = renderer.disableRendering;
      renderer.disableRendering = true;
      
      // Set all lines (setLine() will expand region automatically)
      for (let i = 0; i < lines.length; i++) {
        this.setLine(startLine + i, lines[i]);
      }
      
      // Update region height tracking (setLine() already updated renderer.height)
      this._height = startLine + lines.length - 1;
      
      // Re-enable rendering and flush once
      renderer.disableRendering = wasRenderingDisabled;
      this.renderer.flush();
    } else if (Array.isArray(content)) {
      const startLine = this._height + 1;
      
      // CRITICAL: Disable auto-rendering during line setting to batch updates
      // setLine() will expand the region automatically, but we want to batch renders
      const renderer = this.renderer as any;
      const wasRenderingDisabled = renderer.disableRendering;
      renderer.disableRendering = true;
      
      // Set all lines (setLine() will expand region automatically)
      for (let i = 0; i < content.length; i++) {
        this.setLine(startLine + i, String(content[i]));
      }
      
      // Update region height tracking (setLine() already updated renderer.height)
      this._height = startLine + content.length - 1;
      
      // Re-enable rendering and flush once
      renderer.disableRendering = wasRenderingDisabled;
      this.renderer.flush();
    }
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

  flush(): void {
    // Force immediate render of any pending updates (bypasses throttle)
    this.renderer.flush();
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
      return;
    }
    
    if (this.allComponentDescriptors.length > 0) {
      this.isReRendering = true;
      
      try {
        const renderer = this.renderer as any;
        renderer.logToFile(`[reRenderLastContent] CALLED: height=${this._height} lastRenderedHeight=${renderer.lastRenderedHeight}`);
        const width = this.width;
      
      // First, calculate total height of ALL content (components + static lines)
      let totalHeight = 0;
      for (const descriptorOrArray of this.allComponentDescriptors) {
        const descriptors = Array.isArray(descriptorOrArray) && descriptorOrArray.length > 0 && typeof descriptorOrArray[0] === 'object' && descriptorOrArray[0] !== null && 'type' in descriptorOrArray[0]
          ? descriptorOrArray 
          : [descriptorOrArray];
        
        for (const descriptor of descriptors) {
          if (descriptor.type === 'grid') {
            const component = resolveGrid(this, descriptor);
            totalHeight += component.getHeight();
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
      
      // Now re-render ALL component descriptors starting from line 1
      let currentLine = 1;
      for (const descriptorOrArray of this.allComponentDescriptors) {
        // Each entry can be a single descriptor or an array of descriptors (for multi-line sections)
        const descriptors = Array.isArray(descriptorOrArray) && descriptorOrArray.length > 0 && typeof descriptorOrArray[0] === 'object' && descriptorOrArray[0] !== null && 'type' in descriptorOrArray[0]
          ? descriptorOrArray 
          : [descriptorOrArray];
        
        // Re-render each component in this section
        for (const descriptor of descriptors) {
          if (descriptor.type === 'grid') {
            const component = resolveGrid(this, descriptor);
            const componentHeight = component.getHeight();
            
            // Render component at current line
            component.render(0, currentLine, width);
            
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

  destroy(clearFirst: boolean = false): void {
    this.renderer.destroy(clearFirst);
  }
}

