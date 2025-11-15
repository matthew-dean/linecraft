import { TerminalRegion as NativeRegion, type RegionOptions as NativeRegionOptions } from './native/region.js';
import { applyStyle } from './utils/colors.js';
import { getTerminalWidth } from './utils/terminal.js';
import type { RegionOptions, LineContent } from './types.js';
import { resolveFlexTree } from './api/flex.js';
import { Flex } from './layout/flex.js';

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

  constructor(options: RegionOptions = {}) {
    this._width = options.width ?? getTerminalWidth();
    this._height = options.height ?? 1;

    // Create the native region
    // Only pass width if it was explicitly set by the user (to allow auto-resize)
    const nativeOptions: NativeRegionOptions = {
      height: this._height,
      stdout: options.stdout,
      disableRendering: options.disableRendering,
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
    // (The native region will also expand, but we track it here explicitly)
    if (lineNumber > this._height) {
      this._height = lineNumber;
    }

    // Extract text and apply styling
    const text = typeof content === 'string' ? content : content.text;
    const styled = applyStyle(text, typeof content === 'object' ? content.style : undefined);

    // Update the region (this will expand the native region if needed)
    this.region.setLine(lineNumber, styled);
  }

  set(content: string | LineContent[] | any): void {
    // Check if it's a flex descriptor
    if (typeof content === 'object' && content !== null && 'type' in content) {
      // Resolve and render flex component
      const component = resolveFlexTree(this, content);
      if (component instanceof Flex) {
        // Always sync width before rendering to ensure we have the latest terminal width
        // This is especially important for auto-resize scenarios
        const width = this.width; // This getter syncs with native region
        const height = component.getHeight();
        
        // CRITICAL: Clear pendingFrame before rendering to prevent duplicate lines
        // We need to clear all lines up to the current height, then render fresh
        const oldHeight = this._height;
        this._height = height;
        
        // Directly clear the native region's pendingFrame (don't use setLine which schedules renders)
        // We'll access the native region's internal state to clear it synchronously
        // This prevents render scheduling conflicts
        const nativeRegion = this.region as any;
        
        // CRITICAL: Handle height changes correctly
        // If height decreased, we need to ensure pendingFrame is resized to the new height
        // so the diff algorithm correctly sees extra lines as deleted (null in pendingFrame)
        // If height increased, we need to ensure both frames have enough lines
        
        // First, preserve previousFrame content (don't clear it - diff needs it to see updates)
        // Extend previousFrame if height increased
        while (nativeRegion.previousFrame.length < height) {
          nativeRegion.previousFrame.push('');
        }
        // Don't shrink previousFrame if height decreased - let diff algorithm handle deletions
        
        // Now handle pendingFrame: resize to exact new height
        // If height decreased, this will make pendingFrame shorter, so diff sees deletions
        // If height increased, we'll extend it below
        if (nativeRegion.pendingFrame.length > height) {
          // Height decreased: truncate pendingFrame to new height
          // The diff algorithm will see previousFrame[i] (old) -> null (not in pendingFrame) = delete_line
          nativeRegion.pendingFrame = nativeRegion.pendingFrame.slice(0, height);
        }
        // Ensure pendingFrame has exactly 'height' lines, all cleared
        while (nativeRegion.pendingFrame.length < height) {
          nativeRegion.pendingFrame.push('');
        }
        // Clear all lines in pendingFrame to start fresh (component will fill it)
        for (let i = 0; i < height; i++) {
          nativeRegion.pendingFrame[i] = '';
        }
        
        // CRITICAL: Always update native region height to match component height
        // This ensures cursor positioning and rendering logic work correctly
        // Access private height via type assertion
        (nativeRegion as any).height = height;
        
        // If height increased, expand the region to reserve new lines
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
        // Ensure it has exactly height lines
        while (nativeRegion.pendingFrame.length < height) {
          nativeRegion.pendingFrame.push('');
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

  setThrottle(fps: number): void {
    this.region.setThrottleFps(fps);
  }

  destroy(clearFirst: boolean = false): void {
    this.region.destroy(clearFirst);
  }
}

