// Region management for terminal rendering - TypeScript implementation
// Optimized for Node.js stdout performance

import { diffFrames, type DiffOp } from './diff';
import * as ansi from './ansi';
import { RenderBuffer } from './buffer';
import { Throttle } from './throttle';
import { getTerminalWidth, onResize } from '../utils/terminal';

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
  private autoWrapDisabled: boolean = false; // Track if we've disabled terminal auto-wrap
  private startRow: number | null = null; // Absolute terminal row where region starts (1-based)
  private lastRenderedHeight: number = 0; // Track height from last render to detect changes

  constructor(options: RegionOptions = {}) {
    this.widthExplicitlySet = options.width !== undefined;
    this.width = options.width ?? getTerminalWidth();
    this.height = options.height ?? 1;
    this.lastRenderedHeight = this.height; // Initialize to current height
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
    // If a custom stdout is provided (e.g., for testing),
    // listen to its resize events. Otherwise, use the global onResize utility.
    if (this.stdout && this.stdout !== process.stdout) {
      // Custom stdout - listen to its resize events directly
      const resizeHandler = () => {
        // Re-disable auto-wrap on resize (some terminals reset state on resize)
        if (!this.disableRendering && this.autoWrapDisabled) {
          this.stdout.write(ansi.DISABLE_AUTO_WRAP);
        }
        
        // Only auto-resize if width wasn't explicitly set by the user
        if (!this.widthExplicitlySet) {
          const oldWidth = this.width;
          // Read width directly from the custom stdout
          // CRITICAL: Apply the same margin as getTerminalWidth() - leave last column empty
          const rawWidth = this.stdout.isTTY && this.stdout.columns 
            ? this.stdout.columns 
            : this.width;
          const actualWidth = Math.max(1, rawWidth - 1);
          
          // Only update if it actually changed
          if (actualWidth !== oldWidth) {
            this.width = actualWidth;
            // Don't auto-render here - the high-level API (or user code) will handle rebuilding
            // flex layouts and other dynamic content with the new width
            // This prevents rendering broken layouts before they're rebuilt
          }
        }
      };
      
      this.stdout.on('resize', resizeHandler);
      this.resizeCleanup = () => {
        this.stdout.off('resize', resizeHandler);
      };
    } else {
      // Use the global onResize utility (for real process.stdout)
      this.resizeCleanup = onResize((newWidth, newHeight) => {
        // Re-disable auto-wrap on resize (some terminals reset state on resize)
        // This ensures content doesn't reflow automatically
        // Write directly to stdout since this happens outside of render cycle
        if (!this.disableRendering && this.autoWrapDisabled) {
          this.stdout.write(ansi.DISABLE_AUTO_WRAP);
        }
        
        // Only auto-resize if width wasn't explicitly set by the user
        if (!this.widthExplicitlySet) {
          const oldWidth = this.width;
          // Read width directly from stdout to ensure we get the latest value
          // Node.js updates process.stdout.columns when resize happens
          // CRITICAL: Apply the same margin as getTerminalWidth() - leave last column empty
          const rawWidth = process.stdout.isTTY && process.stdout.columns 
            ? process.stdout.columns 
            : newWidth;
          const actualWidth = Math.max(1, rawWidth - 1);
          
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
  }

  /**
   * Initialize the region by reserving new lines at the bottom of the terminal.
   * This appends new lines so the region doesn't overwrite existing content.
   * 
   * Also disables terminal auto-wrap so we can manage all wrapping ourselves.
   */
  private initializeRegion(): void {
    // Disable terminal auto-wrap - we'll manage all wrapping ourselves
    // This makes reflow math much easier because we control it, not the terminal
    // IMPORTANT: Write directly to stdout and flush immediately so it takes effect before any content
    if (!this.disableRendering && !this.autoWrapDisabled) {
      this.stdout.write(ansi.DISABLE_AUTO_WRAP);
      this.autoWrapDisabled = true;
    }
    if (this.isInitialized) return;

    // Reserve space by printing newlines (this moves cursor down)
    // Each newline reserves one line for the region
    for (let i = 0; i < this.height; i++) {
      this.stdout.write('\n');
    }

    // After printing newlines, cursor is at the start of the line after the region
    // Save this position - it's our anchor point for relative positioning
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
   * 
   * Note: With auto-wrap disabled, we manage all wrapping ourselves.
   * This method sets a single line - if content needs to wrap, it should
   * be handled by the component layer (col, flex, etc.) before calling this.
   */
  setLine(lineNumber: number, content: string): void {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }

    const lineIndex = lineNumber - 1;

    // CRITICAL: Don't expand beyond current height if height was explicitly set
    // The region.set() method for components sets the height explicitly,
    // so we should not expand here. Only expand if we're in "auto-expand" mode.
    // For now, we'll allow expansion but the caller (region.set) will truncate after rendering.
    if (lineIndex >= this.height) {
      this.expandTo(lineIndex + 1);
      // Update height to match
      this.height = lineIndex + 1;
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
    // If new content has fewer lines than current height, clear the extra lines
    this.pendingFrame = [...lines];

    // Ensure frame is the right size - pad with empty strings if needed
    while (this.pendingFrame.length < this.height) {
      this.pendingFrame.push('');
    }
    
    // If we shrunk (fewer lines than before), clear the extra lines in previous frame too
    // This ensures the diff algorithm will detect them as needing to be cleared
    if (lines.length < this.previousFrame.length) {
      for (let i = lines.length; i < this.previousFrame.length; i++) {
        this.previousFrame[i] = this.previousFrame[i] || '';
      }
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

    // CRITICAL: Always disable auto-wrap before every render
    // Some terminals reset this state, or other code might enable it
    // We MUST write it directly to stdout (not to render buffer) so it takes effect immediately
    // Node.js stdout.write() is synchronous and blocks until written, so it's effectively flushed
    if (!this.disableRendering) {
      // Write directly to stdout (bypasses render buffer) to ensure immediate effect
      this.stdout.write(ansi.DISABLE_AUTO_WRAP);
      this.autoWrapDisabled = true;
    }

    // Hide cursor in render buffer too (for consistency)
    this.renderBuffer.write(ansi.HIDE_CURSOR);

    // CRITICAL: OhMyZsh uses absolute positioning, not SAVE/RESTORE cursor
    // SAVE/RESTORE can be unreliable, especially after resize
    // Instead, we'll use a simpler approach: always restore to saved position,
    // but re-save it after every render to keep it accurate
    
    // Restore to saved position (end of region) - this is our anchor point
    this.renderBuffer.write(ansi.RESTORE_CURSOR);
    
    // CRITICAL: If height changed, we need to adjust the saved position
    // The saved cursor is at: startRow + oldHeight
    // We need it at: startRow + newHeight
    if (this.lastRenderedHeight !== this.height && this.savedCursorPosition) {
      const heightDiff = this.height - this.lastRenderedHeight;
      if (heightDiff > 0) {
        // Height increased: move down to new end using cursor movement (not newlines)
        this.renderBuffer.write(ansi.moveCursorDown(heightDiff));
      } else if (heightDiff < 0) {
        // Height decreased: move up to new end
        this.renderBuffer.write(ansi.moveCursorUp(-heightDiff));
      }
      // Re-save the corrected position
      this.renderBuffer.write(ansi.SAVE_CURSOR);
    }
    
    // CRITICAL: Don't use SAVE/RESTORE - it's unreliable
    // Instead, move to start of region by going up from saved position
    // Then render each line, clearing before writing to ensure clean slate
    
    // CRITICAL: Only render up to this.height lines, even if pendingFrame has more
    // This prevents rendering extra lines that were accidentally added by setLine
    // The region.set() method for components should have already truncated pendingFrame,
    // but this is a safety check
    const linesToRender = Math.min(this.pendingFrame.length, this.height);
    
    // Move to start of region (from saved position at end)
    // Use this.height to position correctly
    if (this.height > 0) {
      this.renderBuffer.write(ansi.moveCursorUp(this.height));
    }
    this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
    
    // Now render each line, one at a time, clearing before writing
    // This ensures we're always writing to the correct line and prevents duplicates
    for (let i = 0; i < linesToRender; i++) {
      const content = this.pendingFrame[i];
      
      // If this is not the first line, move down one line
      if (i > 0) {
        this.renderBuffer.write(ansi.moveCursorDown(1));
      }
      
      // CRITICAL: Always clear the line BEFORE writing
      // This prevents any leftover content from causing duplicates
      this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
      this.renderBuffer.write(ansi.CLEAR_LINE);
      this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
      
      // Truncate content to terminal width BEFORE writing
      const plainContent = content.replace(/\x1b\[[0-9;]*m/g, '');
      let contentToWrite = content;
      if (plainContent.length > this.width) {
        // Truncate: find where to cut while preserving ANSI codes
        let visualPos = 0;
        let charPos = 0;
        while (charPos < content.length && visualPos < this.width) {
          if (content[charPos] === '\x1b') {
            // Skip ANSI code
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
      
      // Write truncated content
      this.renderBuffer.write(contentToWrite);
      
      // CRITICAL: After writing, return to start of line
      // This ensures cursor is at a known position for the next iteration
      this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
    }
    
    // Handle deletions (lines that were in previousFrame but not in pendingFrame)
    // Since we've already cleared and re-rendered all lines, deletions are handled
    // by the fact that those lines are no longer in pendingFrame
    // No additional action needed - the lines are already cleared
    
    // After rendering all lines, we're at the start of the last line we rendered
    // this.height should already match linesToRender (updated by region.set() before render)
    // But if they don't match for some reason, update it now
    if (linesToRender !== this.height) {
      this.height = linesToRender;
    }
    
    // We're already at the start of the last rendered line
    // No need to move - we're already at the end of the region
    
    // CRITICAL: Save cursor position at end of region for next render
    // This is our anchor point - we'll move up from here to get to the start
    this.renderBuffer.write(ansi.SAVE_CURSOR);
    this.savedCursorPosition = true;
    
    // Show cursor
    this.renderBuffer.write(ansi.SHOW_CURSOR);

    // Flush buffer (single write to stdout)
    this.renderBuffer.flush();

    // Copy pending to previous
    this.copyPendingToPrevious();
    
    // Update last rendered height for next render
    this.lastRenderedHeight = this.height;

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
    // Re-enable terminal auto-wrap if we disabled it
    // Write directly to stdout to ensure it takes effect immediately
    if (!this.disableRendering && this.autoWrapDisabled) {
      this.stdout.write(ansi.ENABLE_AUTO_WRAP);
      this.autoWrapDisabled = false;
    }
    
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
        // Use MOVE_TO_START_OF_LINE which is more reliable than \r
        this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);

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

