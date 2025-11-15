// Region management for terminal rendering - TypeScript implementation
// Optimized for Node.js stdout performance

import { diffFrames, type DiffOp } from './diff.js';
import * as ansi from './ansi.js';
import { RenderBuffer } from './buffer.js';
import { Throttle } from './throttle.js';
import { getTerminalWidth, onResize } from '../utils/terminal.js';

export interface RegionOptions {
  width?: number; // If not specified, region auto-resizes with terminal
  height?: number;
  stdout?: NodeJS.WriteStream;
  disableRendering?: boolean; // For tests
}

/**
 * TerminalRegion manages a rectangular region of the terminal.
 * 
 * The region reserves new lines at the bottom of the terminal and only
 * updates within those reserved lines. This prevents overwriting existing
 * terminal content.
 * 
 * Performance optimizations:
 * - Frame diffing to minimize writes
 * - Throttling to limit render frequency
 * - Batched writes to stdout
 * - Efficient string operations
 * - Relative cursor movements (no absolute positioning)
 */
export class TerminalRegion {
  private width: number;
  private height: number;
  private pendingFrame: string[] = [];
  private previousFrame: string[] = [];
  private renderScheduled: boolean = false;
  private throttle: Throttle;
  private renderBuffer: RenderBuffer;
  private stdout: NodeJS.WriteStream;
  private disableRendering: boolean;
  private isInitialized: boolean = false;
  private resizeCleanup?: () => void;
  private widthExplicitlySet: boolean;
  private savedCursorPosition: boolean = false; // Track if we've saved the cursor position

  constructor(options: RegionOptions = {}) {
    this.widthExplicitlySet = options.width !== undefined;
    this.width = options.width ?? getTerminalWidth();
    this.height = options.height ?? 1;
    this.stdout = options.stdout ?? process.stdout;
    this.disableRendering = options.disableRendering ?? false;

    // Initialize frames with empty lines
    this.pendingFrame = Array(this.height).fill('');
    this.previousFrame = Array(this.height).fill('');

    this.throttle = new Throttle(60); // Default 60 FPS
    this.renderBuffer = new RenderBuffer(this.stdout);

    // Reserve space for the region by printing newlines
    if (!this.disableRendering) {
      this.initializeRegion();
    }

    // Set up resize handling if width was not explicitly set (auto-resize enabled)
    if (!this.widthExplicitlySet && !this.disableRendering) {
      this.setupResizeHandler();
    }

    // Set up automatic cleanup on process exit
    // This ensures regions are properly cleaned up even if destroy() isn't called
    if (!this.disableRendering) {
      this.setupExitHandler();
    }
  }

  /**
   * Set up process exit handler to automatically clean up the region
   */
  private setupExitHandler(): void {
    // Use a weak reference pattern - store a cleanup function
    // that will be called on process exit
    const cleanup = () => {
      if (this.isInitialized) {
        this.destroy();
      }
    };

    // Register cleanup on various exit events
    process.once('exit', cleanup);
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
    
    // Also handle uncaught exceptions (but don't prevent default behavior)
    const originalUncaughtException = process.listeners('uncaughtException');
    process.once('uncaughtException', (error: Error, origin: NodeJS.UncaughtExceptionOrigin) => {
      cleanup();
      // Re-emit if there were other listeners
      if (originalUncaughtException.length > 0) {
        originalUncaughtException.forEach((listener: NodeJS.UncaughtExceptionListener) => {
          listener(error, origin);
        });
      }
    });
  }

  /**
   * Set up resize event handler to react to terminal size changes
   */
  private setupResizeHandler(): void {
    this.resizeCleanup = onResize((newWidth, newHeight) => {
      // Only auto-resize if width wasn't explicitly set by the user
      if (!this.widthExplicitlySet) {
        const oldWidth = this.width;
        // Read width directly from stdout to ensure we get the latest value
        // Node.js updates process.stdout.columns when resize happens
        const actualWidth = process.stdout.isTTY && process.stdout.columns 
          ? process.stdout.columns 
          : newWidth;
        
        // Only update if it actually changed
        if (actualWidth !== oldWidth) {
          this.width = actualWidth;
          // Don't auto-render here - the high-level API (or user code) will handle rebuilding
          // flex layouts and other dynamic content with the new width
          // This prevents rendering broken layouts before they're rebuilt
        }
      }
    });
  }

  /**
   * Initialize the region by reserving new lines at the bottom of the terminal.
   * This appends new lines so the region doesn't overwrite existing content.
   */
  private initializeRegion(): void {
    if (this.isInitialized) return;

    // Reserve space by printing newlines (this moves cursor down)
    // Each newline reserves one line for the region
    // We print newlines, which means the cursor ends up at the start of the line after the region
    for (let i = 0; i < this.height; i++) {
      this.stdout.write('\n');
    }

    // After printing newlines, cursor is at the start of the line after the region
    // This is our "home" position - we'll always return here after rendering
    // Save this position so we can restore to it after each render
    this.stdout.write(ansi.SAVE_CURSOR);
    this.savedCursorPosition = true;
    this.isInitialized = true;
  }

  /**
   * Expand region to accommodate more lines
   */
  private expandTo(newHeight: number): void {
    const oldHeight = this.height;
    this.height = newHeight;

    // Expand pending frame
    while (this.pendingFrame.length < newHeight) {
      this.pendingFrame.push('');
    }

    // Expand previous frame
    while (this.previousFrame.length < newHeight) {
      this.previousFrame.push('');
    }

    // If we need more lines and region is initialized, reserve additional space
    if (this.isInitialized && newHeight > oldHeight && !this.disableRendering) {
      const additionalLines = newHeight - oldHeight;
      for (let i = 0; i < additionalLines; i++) {
        this.stdout.write('\n');
      }
    }
  }

  /**
   * Get a single line (1-based line numbers)
   * Returns empty string if line doesn't exist
   */
  getLine(lineNumber: number): string {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }

    const lineIndex = lineNumber - 1;
    if (lineIndex >= this.pendingFrame.length) {
      return '';
    }

    return this.pendingFrame[lineIndex] || '';
  }

  /**
   * Set a single line (1-based line numbers)
   */
  setLine(lineNumber: number, content: string): void {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }

    const lineIndex = lineNumber - 1;

    // Expand if needed
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

  /**
   * Set entire content (multiple lines with \n separators)
   */
  set(content: string): void {
    // Split by newlines
    const lines = content.split('\n');

    // Expand region if needed
    if (lines.length > this.height) {
      this.expandTo(lines.length);
    }

    // Update all lines in pending frame
    this.pendingFrame = [...lines];

    // Ensure frame is the right size
    while (this.pendingFrame.length < this.height) {
      this.pendingFrame.push('');
    }

    // Schedule render
    this.scheduleRender();
  }

  /**
   * Schedule a render (respects throttle)
   */
  private scheduleRender(): void {
    if (this.disableRendering) {
      // For tests - just copy pending to previous
      this.previousFrame = [...this.pendingFrame];
      return;
    }

    if (this.throttle.shouldRender()) {
      this.renderNow();
    } else {
      this.renderScheduled = true;
    }
  }

  /**
   * Copy pending frame to previous frame
   */
  private copyPendingToPrevious(): void {
    // Use spread operator for efficient shallow copy
    this.previousFrame = [...this.pendingFrame];
  }

  /**
   * Render immediately (bypasses throttle)
   * Uses relative cursor movements to update only within reserved lines
   */
  renderNow(): void {
    if (this.disableRendering) {
      this.copyPendingToPrevious();
      return;
    }

    // Ensure region is initialized
    if (!this.isInitialized) {
      this.initializeRegion();
    }

    // Hide cursor
    this.renderBuffer.write(ansi.HIDE_CURSOR);

    // Strategy: We saved the cursor position after initialization (at the end of the region).
    // To render, we restore to that position, then move up to the start of the region.
    // After rendering, we restore again to return to the end.
    
    // Restore to saved position (end of region)
    this.renderBuffer.write(ansi.RESTORE_CURSOR);
    
    // Move to start of first line of region
    // We're currently at the end (after the region), so we need to move up by height lines
    // to get to the start of the first line
    if (this.height > 0) {
      this.renderBuffer.write(ansi.moveCursorUp(this.height));
    }
    this.renderBuffer.write('\r'); // Ensure we're at start of line

    // Diff and render
    const diffOps = diffFrames(this.previousFrame, this.pendingFrame);

    let currentLine = 0;
    for (const op of diffOps) {
      switch (op.type) {
        case 'update_line': {
          // Move to line if needed (relative movement)
          if (op.line !== currentLine) {
            const lineDiff = op.line - currentLine;
            if (lineDiff > 0) {
              this.renderBuffer.write(ansi.moveCursorDown(lineDiff));
            } else {
              this.renderBuffer.write(ansi.moveCursorUp(-lineDiff));
            }
            currentLine = op.line;
          }

          // Always return to start of line before updating
          this.renderBuffer.write('\r');
          // Clear line and write new content
          this.renderBuffer.write(ansi.CLEAR_LINE);
          this.renderBuffer.write(op.content);
          
          // After writing, we're at the end of the line content
          // Move to start of next line if not at the last line
          if (currentLine < this.height - 1) {
            this.renderBuffer.write('\r'); // Return to start of current line
            this.renderBuffer.write(ansi.moveCursorDown(1)); // Move to next line
            currentLine += 1;
          } else {
            // We're at the last line, stay here (we'll move past region at the end)
            currentLine += 1;
          }
          break;
        }
        case 'insert_line': {
          // Move to target line
          const lineDiff = op.line - currentLine;
          if (lineDiff > 0) {
            this.renderBuffer.write(ansi.moveCursorDown(lineDiff));
          } else if (lineDiff < 0) {
            this.renderBuffer.write(ansi.moveCursorUp(-lineDiff));
          }

          // Write content
          this.renderBuffer.write(op.content);
          
          // Move to next line
          if (op.line < this.height - 1) {
            this.renderBuffer.write('\r');
            this.renderBuffer.write(ansi.moveCursorDown(1));
          }
          currentLine = op.line + 1;
          break;
        }
        case 'delete_line': {
          // Move to target line
          const lineDiff = op.line - currentLine;
          if (lineDiff > 0) {
            this.renderBuffer.write(ansi.moveCursorDown(lineDiff));
          } else if (lineDiff < 0) {
            this.renderBuffer.write(ansi.moveCursorUp(-lineDiff));
          }

          // Clear the line
          this.renderBuffer.write(ansi.CLEAR_LINE);
          currentLine = op.line;
          break;
        }
        case 'no_change': {
          // Skip unchanged lines - just move to next line
          if (currentLine < this.height - 1) {
            this.renderBuffer.write('\r');
            this.renderBuffer.write(ansi.moveCursorDown(1));
          }
          currentLine += 1;
          break;
        }
      }
    }

    // After rendering all lines, restore cursor to the saved position (end of region)
    this.renderBuffer.write(ansi.RESTORE_CURSOR);
    
    // Show cursor
    this.renderBuffer.write(ansi.SHOW_CURSOR);

    // Flush buffer (single write to stdout)
    this.renderBuffer.flush();

    // Copy pending to previous
    this.copyPendingToPrevious();

    this.renderScheduled = false;
  }

  /**
   * Force immediate render of pending updates (bypasses throttle)
   */
  flush(): void {
    this.renderNow();
  }

  /**
   * Set throttle FPS
   */
  setThrottleFps(fps: number): void {
    this.throttle.setFps(fps);
  }

  /**
   * Clear a single line (1-based)
   */
  clearLine(lineNumber: number): void {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }
    this.setLine(lineNumber, '');
  }

  /**
   * Clear entire region
   */
  clear(): void {
    // Clear all lines in pendingFrame (which may be larger than height if region expanded)
    const maxLines = Math.max(this.height, this.pendingFrame.length);
    for (let i = 1; i <= maxLines; i++) {
      this.setLine(i, '');
    }
  }

  /**
   * Destroy the region (cleanup)
   * Automatically deletes any blank lines from the terminal, but preserves content
   * 
   * @param clearFirst - If true, clears the region before destroying (default: false)
   * 
   * Note: This is automatically called on process exit, but you can also call it explicitly
   * to clean up resources earlier (e.g., before continuing with other terminal output)
   */
  destroy(clearFirst: boolean = false): void {
    // Prevent double-destruction
    if (!this.isInitialized && this.pendingFrame.length === 0) {
      return;
    }
    // Clean up resize handler if it exists
    if (this.resizeCleanup) {
      this.resizeCleanup();
      this.resizeCleanup = undefined;
    }

    // Clear if requested
    if (clearFirst) {
      this.clear();
      // Render the clear immediately so previousFrame is updated
      this.renderNow();
    }

    if (!this.disableRendering && this.isInitialized) {
      // Check if all lines are blank
      // After clearFirst + renderNow(), previousFrame will have empty lines
      // Otherwise, check previousFrame to see if content exists
      const allLinesBlank = this.previousFrame.every(line => line.trim() === '');
      
      // Only delete lines if they are blank
      // If clearFirst was true, we've already cleared and rendered, so previousFrame will be empty
      // If clearFirst was false, we check previousFrame to see if content exists
      if (allLinesBlank && this.height > 0) {
        // Restore to saved position (end of region)
        this.renderBuffer.write(ansi.RESTORE_CURSOR);
        
        // Move to start of first line of region
        this.renderBuffer.write(ansi.moveCursorUp(this.height));
        this.renderBuffer.write('\r'); // Start of first line

        // Delete the blank lines (shifts content up if supported)
        // This will remove the lines from the terminal display
        this.renderBuffer.write(ansi.deleteLines(this.height));

        // Flush the cleanup
        this.renderBuffer.flush();
      }
      // If lines have content, we leave them as-is - the user can see the output
    }
    
    // Clear buffers (internal state only, doesn't affect terminal)
    this.pendingFrame = [];
    this.previousFrame = [];
    this.renderBuffer.clear();
    
    // Mark as destroyed to prevent double-cleanup
    this.isInitialized = false;
  }

  // Getters for width and height
  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }
}

