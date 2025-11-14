import { native } from './native.js';
import { applyStyle } from './utils/colors.js';
import type { RegionOptions, LineContent, TextStyle } from './types.js';

export class TerminalRegion {
  private handle: number;
  private _width: number;
  private _height: number; // Current height (may expand)

  constructor(options: RegionOptions = {}) {
    const x = options.x ?? 0;
    const y = options.y ?? 0;
    this._width = options.width ?? (process.stdout.columns ?? 80);
    this._height = options.height ?? 1; // Default to 1 line, expands as needed
    this.handle = native.createRegion(x, y, this._width, this._height);
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  setLine(lineNumber: number, content: string | LineContent): void {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }

    // Zig handles batching and expansion automatically
    const text = typeof content === 'string' ? content : content.text;
    // Apply styling if provided
    const styled = applyStyle(text, typeof content === 'object' ? content.style : undefined);
    native.setLine(this.handle, lineNumber, styled);
    // Zig will:
    //   - Convert to 0-based internally
    //   - Expand region if lineNumber > current height
    //   - Buffer this update in pending_frame
    //   - Check throttle
    //   - Schedule render if needed (or render immediately if throttle allows)

    // Update our height tracking if Zig expanded
    if (lineNumber > this._height) {
      this._height = lineNumber;
    }
  }

  set(content: string | LineContent[]): void {
    if (typeof content === 'string') {
      // Single string with \n line breaks
      native.set(this.handle, content);
      // Update height based on line count
      this._height = content.split('\n').length;
    } else {
      // Array of LineContent
      const lines = content.map(c => 
        applyStyle(c.text, c.style)
      ).join('\n');
      native.set(this.handle, lines);
      this._height = content.length;
    }
  }

  clearLine(lineNumber: number): void {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }
    native.clearLine(this.handle, lineNumber);
  }

  clear(): void {
    native.clearRegion(this.handle);
  }

  flush(): void {
    // Force immediate render of any pending updates (bypasses throttle)
    native.flush(this.handle);
  }

  setThrottle(fps: number): void {
    native.setThrottleFps(this.handle, fps);
  }

  destroy(): void {
    native.destroyRegion(this.handle);
  }
}

