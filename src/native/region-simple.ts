// SIMPLIFIED Region rendering - back to first principles
// 
// Core approach:
// 1. Reserve N lines at bottom of terminal
// 2. Save cursor position at end (our anchor)
// 3. To render: restore cursor, move up N lines, render each line, save cursor
// 4. Disable auto-wrap globally
// 5. Truncate content to width before writing
// 6. Use diff to only update changed lines

import { diffFrames, type DiffOp } from './diff';
import * as ansi from './ansi';
import { RenderBuffer } from './buffer';
import { Throttle } from './throttle';
import { getTerminalWidth, onResize } from '../utils/terminal';

export interface RegionOptions {
  width?: number;
  height?: number;
  stdout?: NodeJS.WriteStream;
  disableRendering?: boolean;
}

export class TerminalRegion {
  private width: number;
  private height: number;
  private pendingFrame: string[] = [];
  private previousFrame: string[] = [];
  private throttle: Throttle;
  private renderBuffer: RenderBuffer;
  private stdout: NodeJS.WriteStream;
  private disableRendering: boolean;
  private isInitialized: boolean = false;
  private resizeCleanup?: () => void;
  private widthExplicitlySet: boolean;

  constructor(options: RegionOptions = {}) {
    this.widthExplicitlySet = options.width !== undefined;
    this.width = options.width ?? getTerminalWidth();
    this.height = options.height ?? 1;
    this.stdout = options.stdout ?? process.stdout;
    this.disableRendering = options.disableRendering ?? false;

    // Initialize frames
    this.pendingFrame = Array(this.height).fill('');
    this.previousFrame = Array(this.height).fill('');

    this.throttle = new Throttle(30); // Lower FPS for stability
    this.renderBuffer = new RenderBuffer(this.stdout);

    if (!this.disableRendering) {
      this.initializeRegion();
      if (!this.widthExplicitlySet) {
        this.setupResizeHandler();
      }
      this.setupExitHandler();
    }
  }

  private initializeRegion(): void {
    if (this.isInitialized) return;

    // Disable auto-wrap globally
    this.stdout.write(ansi.DISABLE_AUTO_WRAP);

    // Reserve space by printing newlines
    for (let i = 0; i < this.height; i++) {
      this.stdout.write('\n');
    }

    // Save cursor position (end of region) - this is our anchor
    this.stdout.write(ansi.SAVE_CURSOR);
    this.isInitialized = true;
  }

  private setupResizeHandler(): void {
    this.resizeCleanup = onResize((newWidth, newHeight) => {
      // Re-disable auto-wrap (some terminals reset on resize)
      if (!this.disableRendering) {
        this.stdout.write(ansi.DISABLE_AUTO_WRAP);
      }

      if (!this.widthExplicitlySet) {
        this.width = newWidth;
        // On resize, just re-render everything
        this.renderNow();
      }
    });
  }

  private setupExitHandler(): void {
    const cleanup = () => {
      if (this.isInitialized) {
        this.destroy();
      }
    };
    process.once('exit', cleanup);
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
    process.once('uncaughtException', (error: Error, origin: NodeJS.UncaughtExceptionOrigin) => {
      cleanup();
      const originalListeners = process.listeners('uncaughtException');
      originalListeners.forEach((listener: NodeJS.UncaughtExceptionListener) => {
        listener(error, origin);
      });
    });
  }

  getWidth(): number {
    if (!this.widthExplicitlySet) {
      this.width = getTerminalWidth();
    }
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  setLine(lineNumber: number, content: string): void {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }

    const lineIndex = lineNumber - 1;

    // Expand region if needed
    if (lineIndex >= this.height) {
      this.expandTo(lineIndex + 1);
    }

    // Ensure pending frame has enough lines
    while (this.pendingFrame.length <= lineIndex) {
      this.pendingFrame.push('');
    }

    // Update the line
    this.pendingFrame[lineIndex] = content;

    // Schedule render
    this.scheduleRender();
  }

  private expandTo(newHeight: number): void {
    const oldHeight = this.height;
    this.height = newHeight;

    // Expand frames
    while (this.pendingFrame.length < newHeight) {
      this.pendingFrame.push('');
    }
    while (this.previousFrame.length < newHeight) {
      this.previousFrame.push('');
    }

    // Reserve additional lines if initialized
    if (this.isInitialized && newHeight > oldHeight && !this.disableRendering) {
      const additionalLines = newHeight - oldHeight;
      for (let i = 0; i < additionalLines; i++) {
        this.stdout.write('\n');
      }
      // Re-save cursor position after expansion
      this.stdout.write(ansi.SAVE_CURSOR);
    }
  }

  set(content: string): void {
    const lines = content.split('\n');
    
    if (lines.length > this.height) {
      this.expandTo(lines.length);
    }

    this.pendingFrame = [...lines];
    while (this.pendingFrame.length < this.height) {
      this.pendingFrame.push('');
    }

    this.scheduleRender();
  }

  getLine(lineNumber: number): string {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }
    const lineIndex = lineNumber - 1;
    return this.pendingFrame[lineIndex] || '';
  }

  clear(): void {
    for (let i = 0; i < this.pendingFrame.length; i++) {
      this.pendingFrame[i] = '';
    }
    this.scheduleRender();
  }

  clearLine(lineNumber: number): void {
    this.setLine(lineNumber, '');
  }

  private scheduleRender(): void {
    if (this.disableRendering) {
      this.previousFrame = [...this.pendingFrame];
      return;
    }

    if (this.throttle.shouldRender()) {
      this.renderNow();
    }
  }

  /**
   * SIMPLIFIED RENDERING - back to basics
   * 
   * 1. Restore cursor to saved position (end of region)
   * 2. Move up by height
   * 3. For each line: clear, write (truncated), move to start, move down
   * 4. Save cursor position
   */
  renderNow(): void {
    if (this.disableRendering) {
      this.previousFrame = [...this.pendingFrame];
      return;
    }

    if (!this.isInitialized) {
      this.initializeRegion();
    }

    // Ensure auto-wrap is disabled
    this.renderBuffer.write(ansi.DISABLE_AUTO_WRAP);
    this.renderBuffer.write(ansi.HIDE_CURSOR);

    // Restore cursor to saved position (end of region)
    this.renderBuffer.write(ansi.RESTORE_CURSOR);

    // Move up by height to get to start of region
    if (this.height > 0) {
      this.renderBuffer.write(ansi.moveCursorUp(this.height));
    }

    // Render each line
    for (let i = 0; i < this.height; i++) {
      const content = this.pendingFrame[i] || '';

      // Clear the line
      this.renderBuffer.write(ansi.CLEAR_LINE);
      this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);

      // Truncate content to width (strip ANSI to measure, then truncate preserving ANSI)
      const plainContent = content.replace(/\x1b\[[0-9;]*m/g, '');
      let contentToWrite = content;
      if (plainContent.length > this.width) {
        let visualPos = 0;
        let charPos = 0;
        while (charPos < content.length && visualPos < this.width) {
          if (content[charPos] === '\x1b') {
            let ansiEnd = charPos + 1;
            while (ansiEnd < content.length) {
              if (content[ansiEnd] === 'm') {
                ansiEnd++;
                break;
              }
              if ((content[ansiEnd] >= '0' && content[ansiEnd] <= '9') || 
                  content[ansiEnd] === ';' || 
                  content[ansiEnd] === '[') {
                ansiEnd++;
              } else {
                break;
              }
            }
            charPos = ansiEnd;
          } else {
            charPos++;
            visualPos++;
          }
        }
        contentToWrite = content.substring(0, charPos);
      }

      // Write content
      this.renderBuffer.write(contentToWrite);

      // Move to start of line
      this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);

      // Move down to next line (unless last line)
      if (i < this.height - 1) {
        this.renderBuffer.write(ansi.moveCursorDown(1));
      }
    }

    // We're now at the start of the last line
    // Move to end of region (start of last line + height - 1 moves down)
    // Actually, we're already at start of last line, so we need to be at the END
    // of the last line, which is after the region. So move down 1 more time?
    // No wait - the saved position is at the END of the region (after the last line)
    // So we need to move to the start of the line AFTER the region
    // We're currently at start of last line, so move down 1 to get to line after region
    this.renderBuffer.write(ansi.moveCursorDown(1));

    // Save cursor position (end of region) for next render
    this.renderBuffer.write(ansi.SAVE_CURSOR);

    // Show cursor
    this.renderBuffer.write(ansi.SHOW_CURSOR);

    // Flush
    this.renderBuffer.flush();

    // Update previous frame
    this.previousFrame = [...this.pendingFrame];
  }

  flush(): void {
    this.renderNow();
  }

  destroy(clearFirst: boolean = false): void {
    if (!this.isInitialized) return;

    if (clearFirst) {
      this.clear();
      this.renderNow();
    }

    // Re-enable auto-wrap
    if (!this.disableRendering) {
      this.stdout.write(ansi.ENABLE_AUTO_WRAP);
    }

    // Check if all lines are blank
    const allLinesBlank = this.previousFrame.every(line => line.trim() === '');
    
    if (allLinesBlank && this.height > 0) {
      // Restore cursor, move to start of region, delete lines
      this.renderBuffer.write(ansi.RESTORE_CURSOR);
      this.renderBuffer.write(ansi.moveCursorUp(this.height));
      this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
      this.renderBuffer.write(ansi.deleteLines(this.height));
      this.renderBuffer.flush();
    }

    if (this.resizeCleanup) {
      this.resizeCleanup();
    }

    this.isInitialized = false;
  }
}

