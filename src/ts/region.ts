import { TerminalRegion as NativeRegion, type RegionOptions as NativeRegionOptions } from './native/region';
import { applyStyle } from './utils/colors';
import { getTerminalWidth } from './utils/terminal';
import type { RegionOptions, LineContent } from './types';
import { resolveFlexTree } from './api/flex';
import { Flex } from './layout/flex';
import { resolveGrid, type GridDescriptor } from './api/grid';
import { type GridComponent } from './layout/grid';

/**
 * TerminalRegion - High-level API for terminal region management.
 * 
 * This is a wrapper around the native TypeScript implementation that adds:
 * - Styling support (colors, bold, etc.)
 * - Convenient getters for width/height
 * - Same API as before for backward compatibility
 */
export class TerminalRegion {
  private region: NativeRegion;
  private _width: number;
  private _height: number;
  // Track ALL component descriptors that have been set/added, so we can re-render them
  // This is an array of descriptors (or arrays of descriptors for multi-line sections)
  private allComponentDescriptors: any[] = [];
  // Track all lines in the region (component + waitForSpacebar + any whitespace)
  // This allows us to re-render the entire region correctly
  private regionLines: Array<{ type: 'component' | 'static', content?: any, lineNumber: number }> = [];

  constructor(options: RegionOptions = {}) {
    this._width = options.width ?? getTerminalWidth();
    this._height = options.height ?? 1;

    // Create the native region
    // Only pass width if it was explicitly set by the user (to allow auto-resize)
    const nativeOptions: NativeRegionOptions = {
      height: this._height,
      stdout: options.stdout,
      disableRendering: options.disableRendering,
      // CRITICAL: Pass callback to re-render last content during keep-alive and resize
      // This ensures ALL components (flex/col) are re-rendered with current width
      // The region orchestrates this - components don't manage their own re-rendering
      onKeepAlive: () => this.reRenderLastContent(),
    };
    
    // Only set width if user explicitly provided it (allows auto-resize to work)
    if (options.width !== undefined) {
      nativeOptions.width = options.width;
    }
    
    this.region = new NativeRegion(nativeOptions);
  }

  get width(): number {
    // Sync with native region width (important for auto-resize)
    this._width = this.region.getWidth();
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  getLine(lineNumber: number): string {
    return this.region.getLine(lineNumber);
  }

  /**
   * Set a single line (1-based line numbers)
   * 
   * Note: With auto-wrap disabled globally, we manage all wrapping ourselves.
   * This method sets a single line - if content needs to wrap, it should
   * be handled by the component layer (col, flex, etc.) before calling this.
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

    // Update the region (this will expand the native region if needed)
    this.region.setLine(lineNumber, styled);
  }

  /**
   * Set content in the region, replacing all existing content.
   * This always does a full replace - if the new content is the same length,
   * it will overwrite the existing lines. If it's a different length, it will
   * resize the region accordingly.
   */
  set(content: string | LineContent[] | any, ...additionalLines: any[]): void {
    // Check if we have multiple flex/grid descriptors (for multi-line rendering)
    const allContent = additionalLines.length > 0 
      ? [content, ...additionalLines]
      : [content];
    
    // Check if first item is a grid descriptor
    if (allContent.length > 0 && typeof allContent[0] === 'object' && allContent[0] !== null && 'type' in allContent[0] && allContent[0].type === 'grid') {
      // Grid descriptor(s)
      this.allComponentDescriptors = [allContent.length > 1 ? allContent : allContent[0]];
      
      const width = this.width;
      let totalHeight = 0;
      
      const nativeRegion = this.region as any;
      const oldHeight = this._height;
      
      // Calculate total height first
      for (const descriptor of allContent) {
        if (descriptor.type === 'grid') {
          const component = resolveGrid(this, descriptor);
          totalHeight += component.getHeight();
        }
      }
      
      // FULL REPLACE: Truncate both frames to exact new height
      nativeRegion.pendingFrame = nativeRegion.pendingFrame.slice(0, totalHeight);
      nativeRegion.previousFrame = nativeRegion.previousFrame.slice(0, totalHeight);
      
      while (nativeRegion.pendingFrame.length < totalHeight) {
        nativeRegion.pendingFrame.push('');
      }
      while (nativeRegion.previousFrame.length < totalHeight) {
        nativeRegion.previousFrame.push('');
      }
      
      for (let i = 0; i < totalHeight; i++) {
        nativeRegion.pendingFrame[i] = '';
      }
      
      this._height = totalHeight;
      this.regionLines = [];
      for (let i = 0; i < totalHeight; i++) {
        this.regionLines[i] = { type: 'component', lineNumber: i + 1 };
      }
      
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
      
      (nativeRegion as any).height = totalHeight;
      
      if (totalHeight > oldHeight) {
        nativeRegion.expandTo(totalHeight);
      }
      
      this.region.flush();
      return;
    }
    
    // Check if first item is a flex descriptor
    if (allContent.length > 0 && typeof allContent[0] === 'object' && allContent[0] !== null && 'type' in allContent[0]) {
      // CRITICAL: Track ALL component descriptors so we can re-render them
      // This is needed for keep-alive during pause to prevent auto-reflow
      // For multi-line, track the array of descriptors
      // FULL REPLACE: Clear all previous descriptors and start fresh
      this.allComponentDescriptors = [allContent.length > 1 ? allContent : allContent[0]];
      
      const width = this.width; // This getter syncs with native region
      let totalHeight = 0;
      
      const nativeRegion = this.region as any;
      const oldHeight = this._height;
      
      // Calculate total height first
      for (const descriptor of allContent) {
        const component = resolveFlexTree(this, descriptor);
        if (component instanceof Flex) {
          totalHeight += component.getHeight();
        }
      }
      
      // FULL REPLACE: Truncate both frames to exact new height
      // This ensures we always do a full replace, not an append
      nativeRegion.pendingFrame = nativeRegion.pendingFrame.slice(0, totalHeight);
      nativeRegion.previousFrame = nativeRegion.previousFrame.slice(0, totalHeight);
      
      // Ensure both frames have exactly totalHeight lines, all cleared
      while (nativeRegion.pendingFrame.length < totalHeight) {
        nativeRegion.pendingFrame.push('');
      }
      while (nativeRegion.previousFrame.length < totalHeight) {
        nativeRegion.previousFrame.push('');
      }
      
      // Clear all lines in pendingFrame
      for (let i = 0; i < totalHeight; i++) {
        nativeRegion.pendingFrame[i] = '';
      }
      
      // Update region height and regionLines
      this._height = totalHeight;
      this.regionLines = [];
      for (let i = 0; i < totalHeight; i++) {
        this.regionLines[i] = { type: 'component', lineNumber: i + 1 };
      }
      
      // Render each component on its line
      let currentLine = 1;
      for (const descriptor of allContent) {
        const component = resolveFlexTree(this, descriptor);
        if (component instanceof Flex) {
          const height = component.getHeight();
          
          // Render component at current line
          component.render(0, currentLine, width);
          
          // Move to next line
          currentLine += height;
        }
      }
      
      // Update native region height
      (nativeRegion as any).height = totalHeight;
      
      // Expand or contract region if needed
      if (totalHeight > oldHeight) {
        nativeRegion.expandTo(totalHeight);
      }
      
      // Force an immediate render
      this.region.flush();
      return;
    }
    
    // Single grid descriptor
    if (typeof content === 'object' && content !== null && 'type' in content && content.type === 'grid') {
      this.allComponentDescriptors = [content];
      
      const component = resolveGrid(this, content);
      const width = this.width;
      const height = component.getHeight();
      
      const nativeRegion = this.region as any;
      const oldHeight = this._height;
      
      nativeRegion.pendingFrame = nativeRegion.pendingFrame.slice(0, height);
      nativeRegion.previousFrame = nativeRegion.previousFrame.slice(0, height);
      
      while (nativeRegion.pendingFrame.length < height) {
        nativeRegion.pendingFrame.push('');
      }
      while (nativeRegion.previousFrame.length < height) {
        nativeRegion.previousFrame.push('');
      }
      
      for (let i = 0; i < height; i++) {
        nativeRegion.pendingFrame[i] = '';
      }
      
      this._height = height;
      this.regionLines = [];
      for (let i = 0; i < height; i++) {
        this.regionLines[i] = { type: 'component', lineNumber: i + 1 };
      }
      
      (nativeRegion as any).height = height;
      
      if (height > oldHeight) {
        nativeRegion.expandTo(height);
      }
      
      component.render(0, 1, width);
      
      if (nativeRegion.pendingFrame.length > height) {
        nativeRegion.pendingFrame = nativeRegion.pendingFrame.slice(0, height);
      }
      
      this.region.flush();
      return;
    }
    
    // Single flex descriptor
    if (typeof content === 'object' && content !== null && 'type' in content) {
      // CRITICAL: Track ALL component descriptors so we can re-render them
      // This is needed for keep-alive during pause to prevent auto-reflow
      // by re-rendering components with the current width (like during animation)
      // FULL REPLACE: Clear all previous descriptors and start fresh
      this.allComponentDescriptors = [content];
      
      // Resolve and render flex component
      const component = resolveFlexTree(this, content);
      if (component instanceof Flex) {
        // Always sync width before rendering to ensure we have the latest terminal width
        // This is especially important for auto-resize scenarios
        const width = this.width; // This getter syncs with native region
        const height = component.getHeight();
        
        const nativeRegion = this.region as any;
        const oldHeight = this._height;
        
        // FULL REPLACE: Truncate both frames to exact new height
        // This ensures we always do a full replace, not an append
        nativeRegion.pendingFrame = nativeRegion.pendingFrame.slice(0, height);
        nativeRegion.previousFrame = nativeRegion.previousFrame.slice(0, height);
        
        // Ensure both frames have exactly 'height' lines, all cleared
        while (nativeRegion.pendingFrame.length < height) {
          nativeRegion.pendingFrame.push('');
        }
        while (nativeRegion.previousFrame.length < height) {
          nativeRegion.previousFrame.push('');
        }
        
        // Clear all lines in pendingFrame to start fresh
        for (let i = 0; i < height; i++) {
          nativeRegion.pendingFrame[i] = '';
        }
        
        // Update region height and regionLines
        this._height = height;
        this.regionLines = [];
        for (let i = 0; i < height; i++) {
          this.regionLines[i] = { type: 'component', lineNumber: i + 1 };
        }
        
        // Update native region height
        (nativeRegion as any).height = height;
        
        // Expand or contract region if needed
        if (height > oldHeight) {
          nativeRegion.expandTo(height);
        }
        
        // Now render the component fresh (this will call setLine which updates pendingFrame)
        component.render(0, 1, width);
        
        // CRITICAL: Truncate pendingFrame to exact height after rendering
        // setLine might have expanded it beyond what we need
        if (nativeRegion.pendingFrame.length > height) {
          nativeRegion.pendingFrame = nativeRegion.pendingFrame.slice(0, height);
        }
        
        // Force an immediate render to show the content
        this.region.flush();
      }
      return;
    }

    // Original string/array handling
    if (typeof content === 'string') {
      // Single string with \n line breaks
      const lineCount = content.split('\n').length;
      this._height = lineCount;
      this.region.set(content);
    } else if (Array.isArray(content)) {
      // Array of LineContent - apply styling to each
      this._height = content.length;
      const lines = content.map(c => 
        applyStyle(c.text, c.style)
      ).join('\n');
      this.region.set(lines);
    }
  }

  /**
   * Add content to the region, appending it after existing content.
   * This is useful for adding multiple sections without overwriting previous content.
   */
  add(content: string | LineContent[] | any, ...additionalLines: any[]): void {
    // Check if we have multiple flex descriptors
    const allContent = additionalLines.length > 0 
      ? [content, ...additionalLines]
      : [content];
    
    // Check if first item is a flex descriptor
    if (allContent.length > 0 && typeof allContent[0] === 'object' && allContent[0] !== null && 'type' in allContent[0]) {
      const width = this.width;
      let totalHeight = 0;
      
      // Calculate total height of new content
      // CRITICAL: Resolve components ONCE and store them to avoid double-counting
      const resolvedComponents: Flex[] = [];
      for (const descriptor of allContent) {
        const component = resolveFlexTree(this, descriptor);
        if (component instanceof Flex) {
          resolvedComponents.push(component);
          const compHeight = component.getHeight();
          totalHeight += compHeight;
        }
      }
      
      const nativeRegion = this.region as any;
      const startLine = this._height + 1; // Start appending after existing content
      
      // DEBUG: Log what we're about to add
      if (process.env.DEBUG_REGION) {
        console.log(`[add] Current height: ${this._height}, Adding ${totalHeight} lines, New height will be: ${this._height + totalHeight}`);
      }
      
      // Extend frames to accommodate new content
      while (nativeRegion.pendingFrame.length < this._height + totalHeight) {
        nativeRegion.pendingFrame.push('');
      }
      while (nativeRegion.previousFrame.length < this._height + totalHeight) {
        nativeRegion.previousFrame.push('');
      }
      
      // Clear lines where new content will be rendered
      for (let i = 0; i < totalHeight; i++) {
        const lineIndex = this._height + i;
        nativeRegion.pendingFrame[lineIndex] = '';
      }
      
      // Update regionLines
      for (let i = 0; i < totalHeight; i++) {
        const lineNumber = this._height + i + 1;
        this.regionLines.push({ type: 'component', lineNumber });
      }
      
      // CRITICAL: Track this new content so we can re-render it during keep-alive
      // Append the descriptors to our tracking array
      const descriptorsToAdd = allContent.length > 1 ? allContent : allContent[0];
      this.allComponentDescriptors.push(descriptorsToAdd);
      
      // CRITICAL: Update region height BEFORE rendering
      // This prevents setLine() from expanding the region when components render
      const oldHeight = this._height;
      this._height += totalHeight;
      (nativeRegion as any).height = this._height;
      
      // Expand region to accommodate new content (before rendering)
      nativeRegion.expandTo(this._height);
      
      // Render each component starting from startLine
      // Use the already-resolved components to avoid re-resolving
      let currentLine = startLine;
      for (const component of resolvedComponents) {
        const height = component.getHeight();
        
        // Render component at current line
        component.render(0, currentLine, width);
        
        // Move to next line
        currentLine += height;
      }
      
      // DEBUG: Verify height after update
      if (process.env.DEBUG_REGION) {
        console.log(`[add] After height update: ${this._height}, Native height: ${(nativeRegion as any).height}`);
      }
      
      // Force an immediate render
      // CRITICAL: We need to flush to show the content, but we need to ensure
      // that reRenderLastContent() doesn't get called during flush
      // The native region's flush() just calls renderNow(), which shouldn't trigger keep-alive
      this.region.flush();
      return;
    }
    
    // Single flex descriptor
    if (typeof content === 'object' && content !== null && 'type' in content) {
      const component = resolveFlexTree(this, content);
      if (component instanceof Flex) {
        const width = this.width;
        const height = component.getHeight();
        const startLine = this._height + 1;
        
        const nativeRegion = this.region as any;
        
        // Extend frames
        while (nativeRegion.pendingFrame.length < this._height + height) {
          nativeRegion.pendingFrame.push('');
        }
        while (nativeRegion.previousFrame.length < this._height + height) {
          nativeRegion.previousFrame.push('');
        }
        
        // Clear lines where new content will be rendered
        for (let i = 0; i < height; i++) {
          nativeRegion.pendingFrame[this._height + i] = '';
        }
        
        // Update regionLines
        for (let i = 0; i < height; i++) {
          this.regionLines.push({ type: 'component', lineNumber: this._height + i + 1 });
        }
        
        // CRITICAL: Track this new content so we can re-render it during keep-alive
        // Append the descriptor to our tracking array
        this.allComponentDescriptors.push(content);
        
        // CRITICAL: Update region height BEFORE rendering
        // This prevents setLine() from expanding the region when components render
        this._height += height;
        (nativeRegion as any).height = this._height;
        
        // Expand region to accommodate new content (before rendering)
        nativeRegion.expandTo(this._height);
        
        // Render component
        component.render(0, startLine, width);
        
        // Force render
        this.region.flush();
      }
      return;
    }

    // String/array handling - append after existing content
    if (typeof content === 'string') {
      const lines = content.split('\n');
      const startLine = this._height + 1;
      
      for (let i = 0; i < lines.length; i++) {
        this.setLine(startLine + i, lines[i]);
      }
    } else if (Array.isArray(content)) {
      const startLine = this._height + 1;
      for (let i = 0; i < content.length; i++) {
        this.setLine(startLine + i, content[i]);
      }
    }
  }


  clearLine(lineNumber: number): void {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }
    this.region.clearLine(lineNumber);
  }

  clear(): void {
    this.region.clear();
  }

  flush(): void {
    // Force immediate render of any pending updates (bypasses throttle)
    this.region.flush();
  }

  /**
   * Re-render the last content that was set
   * This re-renders all components (flex/col) with the current width
   * Used by resize handler and keep-alive to prevent auto-reflow
   * The region orchestrates this - components don't manage their own re-rendering
   * 
   * CRITICAL: Re-renders the entire region, including:
   * - Component lines (flex/col)
   * - Static lines (waitForSpacebar, whitespace)
   * This ensures everything is in the correct position
   */
  reRenderLastContent(): void {
    if (this.allComponentDescriptors.length > 0) {
      const nativeRegion = this.region as any;
      const width = this.width;
      
      // First, calculate total height of ALL content
      let totalHeight = 0;
      for (const descriptorOrArray of this.allComponentDescriptors) {
        const descriptors = Array.isArray(descriptorOrArray) && descriptorOrArray.length > 0 && typeof descriptorOrArray[0] === 'object' && descriptorOrArray[0] !== null && 'type' in descriptorOrArray[0]
          ? descriptorOrArray 
          : [descriptorOrArray];
        
        for (const descriptor of descriptors) {
          const component = resolveFlexTree(this, descriptor);
          if (component instanceof Flex) {
            totalHeight += component.getHeight();
          }
        }
      }
      
      // CRITICAL: Ensure frames are the correct size BEFORE re-rendering
      // This prevents overwriting or truncating content incorrectly
      while (nativeRegion.pendingFrame.length < totalHeight) {
        nativeRegion.pendingFrame.push('');
      }
      while (nativeRegion.previousFrame.length < totalHeight) {
        nativeRegion.previousFrame.push('');
      }
      
      // Truncate frames to exact height (in case they're too large)
      nativeRegion.pendingFrame = nativeRegion.pendingFrame.slice(0, totalHeight);
      nativeRegion.previousFrame = nativeRegion.previousFrame.slice(0, totalHeight);
      
      // Clear all lines before re-rendering
      for (let i = 0; i < totalHeight; i++) {
        nativeRegion.pendingFrame[i] = '';
      }
      
      // Now re-render ALL component descriptors starting from line 1
      let currentLine = 1;
      for (const descriptorOrArray of this.allComponentDescriptors) {
        // Each entry can be a single descriptor or an array of descriptors (for multi-line sections)
        const descriptors = Array.isArray(descriptorOrArray) && descriptorOrArray.length > 0 && typeof descriptorOrArray[0] === 'object' && descriptorOrArray[0] !== null && 'type' in descriptorOrArray[0]
          ? descriptorOrArray 
          : [descriptorOrArray];
        
        // Re-render each component in this section
        for (const descriptor of descriptors) {
          const component = resolveFlexTree(this, descriptor);
          if (component instanceof Flex) {
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
      (nativeRegion as any).height = totalHeight;
      
      // CRITICAL: Re-render static lines (waitForSpacebar, whitespace)
      // These are tracked in regionLines with type 'static'
      for (let i = 0; i < this.regionLines.length; i++) {
        const lineInfo = this.regionLines[i];
        if (lineInfo.type === 'static' && lineInfo.content !== undefined) {
          // Re-render this static line
          const lineNumber = i + 1;
          // Ensure pendingFrame has enough lines
          while (nativeRegion.pendingFrame.length < lineNumber) {
            nativeRegion.pendingFrame.push('');
          }
          nativeRegion.pendingFrame[lineNumber - 1] = lineInfo.content;
        }
      }
      
      // Force an immediate render to show all content
      this.region.flush();
    }
  }

  setThrottle(fps: number): void {
    // Note: setThrottleFps doesn't exist on native region, removing for now
    // this.region.setThrottleFps(fps);
  }

  destroy(clearFirst: boolean = false): void {
    this.region.destroy(clearFirst);
  }
}

