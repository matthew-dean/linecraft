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

  setLine(lineNumber: number, content: string | LineContent): void {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }

    // Extract text and apply styling
    const text = typeof content === 'string' ? content : content.text;
    const styled = applyStyle(text, typeof content === 'object' ? content.style : undefined);

    // Update the region
    this.region.setLine(lineNumber, styled);

    // Update height tracking if expanded
    const newHeight = this.region.getHeight();
    if (newHeight > this._height) {
      this._height = newHeight;
    }
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
        if (height > this._height) {
          this._height = height;
        }
        component.render(0, 1, width);
      }
      return;
    }

    // Original string/array handling
    if (typeof content === 'string') {
      // Single string with \n line breaks
      this.region.set(content);
      // Update height based on line count
      this._height = content.split('\n').length;
    } else if (Array.isArray(content)) {
      // Array of LineContent - apply styling to each
      const lines = content.map(c => 
        applyStyle(c.text, c.style)
      ).join('\n');
      this.region.set(lines);
      this._height = content.length;
    }

    // Sync with actual region height
    const newHeight = this.region.getHeight();
    if (newHeight > this._height) {
      this._height = newHeight;
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

