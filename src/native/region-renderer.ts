// Region management for terminal rendering - TypeScript implementation
// Optimized for Node.js stdout performance

import { diffFrames, type DiffOp } from './diff';
import * as ansi from './ansi';
import { RenderBuffer } from './buffer';
import { Throttle } from './throttle';
import { queryCursorPosition } from '../utils/cursor-position';
import { getTerminalWidth, onResize } from '../utils/terminal';
import { logToFile as logToFileUtil } from '../utils/debug-log';

export interface RegionRendererOptions {
  width?: number; // If not specified, region auto-resizes with terminal
  height?: number;
  stdout?: NodeJS.WriteStream;
  disableRendering?: boolean; // For tests
  onKeepAlive?: () => void;
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
export class RegionRenderer {
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
  private initializationPromise: Promise<void> | null = null; // Promise for async initialization
  private resizeCleanup?: () => void;
  private widthExplicitlySet: boolean;
  private savedCursorPosition: boolean = false; // Track if we've saved the cursor position
  private autoWrapDisabled: boolean = false; // Track if we've disabled terminal auto-wrap
  private startRow: number | null = null; // Absolute terminal row where region starts (1-based)
  private visibleRegionTopRow: number | null = null; // Terminal row of the top of the visible region (1-based, updated after scrolls)
  private lastRenderedHeight: number = 0; // Track height from last render to detect changes
  private hasRendered: boolean = false; // Track if we've rendered at least once
  private isRendering: boolean = false; // Prevent concurrent renders
  private resizeJustHappened: boolean = false; // Track if resize happened to re-initialize cursor
  private queriedCursorPosition: { row: number; col: number } | null = null; // Queried position after resize
  private static logFileCleared: boolean = false; // Track if log file has been cleared for this process

  private onKeepAlive?: () => void;
  
  // Static tracking for exit handler (singleton pattern to prevent memory leak)
  private static exitHandlerSetup: boolean = false;
  private static activeRegions: Set<RegionRenderer> = new Set();

  constructor(options: RegionRendererOptions = {}) {
    this.widthExplicitlySet = options.width !== undefined;
    // CRITICAL: getTerminalWidth() returns (terminal_width - 2) to prevent cursor wrapping
    // Components receive this as availableWidth and can write up to the full availableWidth
    const maxSafeWidth = getTerminalWidth();
    this.width = options.width !== undefined 
      ? Math.min(options.width, maxSafeWidth)
      : maxSafeWidth;
    this.height = options.height ?? 1;
    this.lastRenderedHeight = 0; // Start at 0 - will be set after first render
    this.hasRendered = false; // Haven't rendered yet
    this.stdout = options.stdout ?? process.stdout;
    this.disableRendering = options.disableRendering ?? false;
    this.onKeepAlive = options.onKeepAlive;

    // Initialize frames with empty lines
    this.pendingFrame = Array(this.height).fill('');
    this.previousFrame = Array(this.height).fill('');

    this.throttle = new Throttle(60); // Default 60 FPS
    this.renderBuffer = new RenderBuffer(this.stdout);

    // Reserve space for the region by printing newlines
    // Start initialization async (but don't await - it will be awaited on first flush)
    if (!this.disableRendering) {
      this.initializationPromise = this.initializeRegion();
    }

    // Set up resize handling if width was not explicitly set (auto-resize enabled)
    if (!this.widthExplicitlySet && !this.disableRendering) {
      this.setupResizeHandler();
    }

    // Set up automatic cleanup on process exit
    // This ensures regions are properly cleaned up even if destroy() isn't called
    // Use singleton pattern to prevent memory leak from multiple listeners
    if (!this.disableRendering) {
      RegionRenderer.setupExitHandler();
      RegionRenderer.activeRegions.add(this);
    }
  }

  /**
   * Set up process exit handler to automatically clean up all regions
   * Uses singleton pattern to prevent memory leak from multiple listeners
   */
  private static setupExitHandler(): void {
    // Only set up once globally
    if (RegionRenderer.exitHandlerSetup) {
      return;
    }
    RegionRenderer.exitHandlerSetup = true;

    // Cleanup function that destroys all active regions
    const cleanup = () => {
      // Destroy all active regions
      for (const region of RegionRenderer.activeRegions) {
        if (region.isInitialized) {
          region.destroy();
        }
      }
      RegionRenderer.activeRegions.clear();
    };

    // Register cleanup on various exit events (only once globally)
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
        // CRITICAL: Don't modify terminal state if region is destroyed
        // This prevents leaving terminal in bad state after program finishes
        if (!this.isInitialized) {
          return;
        }
        
        // CRITICAL: Don't re-disable auto-wrap on resize if we're about to destroy
        // Some terminals/shells (like zsh) may insert lines on resize if auto-wrap is disabled
        // We only disable auto-wrap during active rendering, not after program finishes
        // Re-disable auto-wrap on resize (some terminals reset state on resize)
        // BUT: Only if we're actively rendering (autoWrapDisabled should only be true during active use)
        if (!this.disableRendering && this.autoWrapDisabled && this.isInitialized) {
          this.stdout.write(ansi.DISABLE_AUTO_WRAP);
        }
        
        // Only auto-resize if width wasn't explicitly set by the user
        if (!this.widthExplicitlySet) {
          const oldWidth = this.width;
          // Read width directly from the custom stdout
          // CRITICAL: getTerminalWidth() returns (terminal_width - 2) to prevent cursor wrapping
          const actualWidth = getTerminalWidth();
          
          // Only update if it actually changed
          if (actualWidth !== oldWidth) {
            this.width = actualWidth;
            // Don't auto-render here - the high-level API (or user code) will handle rebuilding
            // grid layouts and other dynamic content with the new width
            // This prevents rendering broken layouts before they're rebuilt
          }
        }
        
        // CRITICAL: Mark that resize happened - cursor position may be invalid
        // We'll re-initialize cursor position on next render
        this.resizeJustHappened = true;
        this.savedCursorPosition = false;
        
        // CRITICAL: Trigger re-render via high-level API to update content with new width
        // This prevents content from being rendered over (like spacebar prompt)
        // The old code was a single class, so it didn't need this callback
        // But our split architecture needs to notify the high-level API to re-render
        if (this.onKeepAlive) {
          this.onKeepAlive();
        }
      };
      
      this.stdout.on('resize', resizeHandler);
      this.resizeCleanup = () => {
        this.stdout.off('resize', resizeHandler);
      };
    } else {
      // Use the global onResize utility (for real process.stdout)
      this.resizeCleanup = onResize((newWidth, newHeight) => {
        // CRITICAL: Don't modify terminal state if region is destroyed
        // This prevents leaving terminal in bad state after program finishes
        if (!this.isInitialized) {
          return;
        }
        
        // CRITICAL: Don't re-disable auto-wrap on resize if we're about to destroy
        // Some terminals/shells (like zsh) may insert lines on resize if auto-wrap is disabled
        // We only disable auto-wrap during active rendering, not after program finishes
        // The isInitialized check above should prevent this, but be extra safe
        // Re-disable auto-wrap on resize (some terminals reset state on resize)
        // This ensures content doesn't reflow automatically
        // Write directly to stdout since this happens outside of render cycle
        // BUT: Only if we're actively rendering (autoWrapDisabled should only be true during active use)
        if (!this.disableRendering && this.autoWrapDisabled && this.isInitialized) {
          this.stdout.write(ansi.DISABLE_AUTO_WRAP);
        }
        
        // Only auto-resize if width wasn't explicitly set by the user
        if (!this.widthExplicitlySet) {
          const oldWidth = this.width;
          // Read width directly from stdout to ensure we get the latest value
          // Node.js updates process.stdout.columns when resize happens
          // CRITICAL: getTerminalWidth() returns (terminal_width - 2) to prevent cursor wrapping
          const actualWidth = getTerminalWidth();
          
          // Only update if it actually changed
          if (actualWidth !== oldWidth) {
            this.width = actualWidth;
            // Don't auto-render here - the high-level API (or user code) will handle rebuilding
            // flex layouts and other dynamic content with the new width
            // This prevents rendering broken layouts before they're rebuilt
          }
        }
        
        // CRITICAL: Mark that resize happened - cursor position may be invalid
        // We'll query the actual cursor position and recalibrate
        // NOTE: Don't clear savedCursorPosition - we'll handle it in renderNow()
        // by not restoring it when resizeJustHappened=true
        this.logToFile(`[resize handler] SETTING resizeJustHappened=true`);
        this.resizeJustHappened = true;
        // DON'T clear savedCursorPosition - it might still be valid, and we'll handle
        // the resize case in renderNow() by not restoring it
        
        // CRITICAL: Query cursor position after resize to use actual position instead of saved
        // The saved position becomes invalid when terminal scrolls
        // NOTE: Disabled for now - the polling interferes with stdin (causes hang)
        // this.queryCursorPositionAfterResize();
        
        // Also poll multiple times for debugging
        // NOTE: Disabled for now - the polling interferes with stdin (causes hang)
        // this.pollCursorPositionAfterResize();
        
        // CRITICAL: Trigger re-render via high-level API to update content with new width
        // This prevents content from being rendered over (like spacebar prompt)
        // The old code was a single class, so it didn't need this callback
        // But our split architecture needs to notify the high-level API to re-render
        // NOTE: Disabled cursor position querying for now - it was causing issues
        // The queried position might be at the bottom of the screen, not where the region actually is
        // if (this.onKeepAlive) {
        //   this.onKeepAlive();
        // }
        // TODO: Re-enable cursor querying once we figure out how to use it correctly
        if (this.onKeepAlive) {
          this.onKeepAlive();
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
  private async initializeRegion(): Promise<void> {
    // Disable terminal auto-wrap - we'll manage all wrapping ourselves
    // This makes reflow math much easier because we control it, not the terminal
    // IMPORTANT: Write directly to stdout and flush immediately so it takes effect before any content
    if (!this.disableRendering && !this.autoWrapDisabled) {
      this.stdout.write(ansi.DISABLE_AUTO_WRAP);
      this.autoWrapDisabled = true;
    }
    if (this.isInitialized) return;

    // CRITICAL: Query cursor position BEFORE printing newlines
    // This establishes where the region starts in terminal space
    // We query BEFORE rendering so stdin is restored before waitForSpacebar
    let queriedRow: number | null = null;
    if (process.stdin.isTTY && process.stdout.isTTY) {
      const queryStartTime = Date.now();
      try {
        this.logToFile(`[initializeRegion] QUERYING cursor position before printing newlines (timestamp: ${new Date().toISOString()})...`);
        const pos = await queryCursorPosition(500);
        const queryEndTime = Date.now();
        const queryDuration = queryEndTime - queryStartTime;
        queriedRow = pos.row;
        // CRITICAL: Start two lines BELOW the cursor to avoid overwriting the prompt and PNPM output
        // The cursor is at the prompt line, and there may be PNPM output on the line above or at the cursor
        // So we start the region two lines below to be safe
        this.startRow = pos.row + 2;
        this.logToFile(`[initializeRegion] ✓ GOT cursor position back: row=${pos.row}, col=${pos.col}, setting startRow=${this.startRow} (two lines below cursor to avoid overwriting prompt and PNPM output, query took ${queryDuration}ms, timestamp: ${new Date().toISOString()})`);
        // CRITICAL: At this point, queryCursorPosition has cleaned up and restored stdin
        // stdin should be in a clean state for waitForSpacebar
      } catch (err) {
        const queryEndTime = Date.now();
        const queryDuration = queryEndTime - queryStartTime;
        // Query failed - estimate from terminal height
        const terminalHeight = process.stdout.isTTY && process.stdout.rows ? process.stdout.rows : 24;
        this.startRow = terminalHeight - this.height + 1;
        this.logToFile(`[initializeRegion] ✗ Cursor query FAILED after ${queryDuration}ms: ${err instanceof Error ? err.message : String(err)}, estimating startRow=${this.startRow} (timestamp: ${new Date().toISOString()})`);
      }
    } else {
      // Not a TTY - estimate
      const terminalHeight = process.stdout.isTTY && process.stdout.rows ? process.stdout.rows : 24;
      this.startRow = terminalHeight - this.height + 1;
      this.logToFile(`[initializeRegion] Not a TTY, estimating startRow=${this.startRow} (timestamp: ${new Date().toISOString()})`);
    }
    
    this.isInitialized = true;

    // CRITICAL: Position to startRow before printing newlines
    // We queried the cursor position and set startRow = queriedRow + 2
    // After query cleanup, the cursor should still be at approximately the queried position
    // So we need to move down (startRow - queriedRow) = 2 lines to get to startRow
    if (queriedRow !== null) {
      const linesToMoveDown = this.startRow - queriedRow;
      if (linesToMoveDown > 0) {
        this.stdout.write(ansi.moveCursorDown(linesToMoveDown));
        this.logToFile(`[initializeRegion] Moved down ${linesToMoveDown} lines to position at startRow=${this.startRow} (queriedRow=${queriedRow})`);
      }
    }
    
    // Reserve space by printing newlines (this moves cursor down)
    // Each newline reserves one line for the region
    // The region starts where the cursor is BEFORE printing newlines (which is now at startRow)
    // After printing newlines, we're at the line after the region
    for (let i = 0; i < this.height; i++) {
      this.stdout.write('\n');
    }

    // After printing newlines, cursor is at the start of the line after the region
    // But we want to save at the START of the LAST line (to match where we save after rendering)
    // So move up one line to get to the start of the last line
    if (this.height > 0) {
      this.stdout.write(ansi.moveCursorUp(1));
    }
    this.stdout.write(ansi.MOVE_TO_START_OF_LINE);
    
    // Now we're at the start of the last line - save this position
    // Note: After rendering (when there's content), we save at the END of content
    // But for initialization, we're creating empty lines, so start of line is appropriate
    this.stdout.write(ansi.SAVE_CURSOR);
    this.savedCursorPosition = true;
  }

  /**
   * Query cursor position after resize and store it for use in rendering
   * This helps us position correctly when the saved cursor position is invalid
   */
  private async queryCursorPositionAfterResize(): Promise<void> {
    if (this.disableRendering || !process.stdin.isTTY || !process.stdout.isTTY) {
      return; // Can't query if not a TTY
    }

    try {
      // Query cursor position after a small delay to let resize settle
      await new Promise(resolve => setTimeout(resolve, 50));
      const pos = await queryCursorPosition(500);
      this.queriedCursorPosition = pos;
      this.logToFile(`[cursor query] After resize - queried cursor at row=${pos.row}, col=${pos.col}`);
    } catch (err) {
      this.logToFile(`[cursor query] Failed to query cursor position: ${err instanceof Error ? err.message : String(err)}`);
      this.queriedCursorPosition = null;
    }
  }

  /**
   * Poll cursor position multiple times after resize to understand if it's moving
   * This helps debug cursor position inconsistencies on resize
   */
  private pollCursorPositionAfterResize(): void {
    if (this.disableRendering || !process.stdin.isTTY || !process.stdout.isTTY) {
      return; // Can't poll if not a TTY
    }

    let pollCount = 0;
    const maxPolls = 10; // Poll 10 times over ~1 second
    const pollInterval = 100; // 100ms between polls
    
    const poll = async () => {
      try {
        const pos = await queryCursorPosition(500); // 500ms timeout per poll
        pollCount++;
        this.logToFile(`[cursor poll ${pollCount}/${maxPolls}] After resize - cursor at row=${pos.row}, col=${pos.col}`);
        
        // After first few polls, trigger a redraw, then continue polling
        // This helps us see if the cursor position changes after redraw
        if (pollCount === 3 && this.onKeepAlive) {
          this.logToFile(`[cursor poll] Triggering redraw after 3 polls (cursor was at row=${pos.row}, col=${pos.col})`);
          this.onKeepAlive();
          // Wait a bit for redraw to complete, then continue polling
          setTimeout(() => {
            if (pollCount < maxPolls) {
              setTimeout(poll, pollInterval);
            }
          }, 100); // Give redraw more time to complete
        } else if (pollCount < maxPolls) {
          setTimeout(poll, pollInterval);
        } else {
          this.logToFile(`[cursor poll] Finished polling after ${maxPolls} attempts`);
        }
      } catch (err) {
        pollCount++;
        this.logToFile(`[cursor poll ${pollCount}/${maxPolls}] Failed to query cursor position: ${err instanceof Error ? err.message : String(err)}`);
        if (pollCount < maxPolls) {
          setTimeout(poll, pollInterval);
        }
      }
    };

    // Start polling after a small delay to let resize settle
    setTimeout(() => {
      this.logToFile(`[cursor poll] Starting cursor position polling after resize`);
      poll();
    }, 10);
  }

  private logToFile(message: string): void {
    logToFileUtil(message);
  }

  /**
   * Strip ANSI escape codes from a string
   */
  private stripAnsi(str: string): string {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Get terminal height, with fallback
   */
  private getTerminalHeight(): number {
    return this.stdout.isTTY && this.stdout.rows 
      ? this.stdout.rows 
      : 24; // fallback
  }

  /**
   * Truncate content to maxWidth while preserving ANSI codes
   * Only truncates if content is significantly longer (more than 2 chars) as a safety measure
   */
  private truncateContent(content: string, maxWidth: number): string {
    const plainContent = this.stripAnsi(content);
    // CRITICAL: Never write exactly maxWidth characters - it puts cursor at last column
    // Writing exactly maxWidth (e.g., 71) puts cursor at column maxWidth+1 (e.g., 72 = terminal width)
    // This can cause cursor positioning issues. Always truncate to maxWidth - 1
    const safeMaxWidth = maxWidth - 1;
    if (plainContent.length <= safeMaxWidth) {
      return content;
    }
    
    // Find where to cut while preserving ANSI codes
    let visualPos = 0;
    let charPos = 0;
    while (charPos < content.length && visualPos < safeMaxWidth) {
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
    return content.substring(0, charPos);
  }

  /**
   * Clear the current line and move to start
   */
  private clearCurrentLine(): void {
    this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
    this.renderBuffer.write(ansi.CLEAR_LINE);
    this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
  }

  /**
   * Move to top-left of region and save cursor position
   */
  private moveToTopLeftAndSave(linesToRender: number, context: string = ''): void {
    // After rendering, we're at the end of the last rendered line
    // To get to the top-left (start of first line), we need to move up (linesToRender - 1) lines
    // Then move to start of line
    // CRITICAL: With auto-wrap disabled, the cursor stays on the same line after writing
    // So if we rendered 1 line, we're on line 1 (at the end), and we move up 0 lines
    // If we rendered N lines, we're on line N (at the end), and we move up (N - 1) lines
    const linesToMoveUp = linesToRender > 1 ? linesToRender - 1 : 0;
    this.logToFile(`[moveToTopLeftAndSave] linesToRender=${linesToRender}, moving up ${linesToMoveUp} lines to get to top-left (after rendering, cursor is at end of last line)`);
    if (linesToMoveUp > 0) {
      this.renderBuffer.write(ansi.moveCursorUp(linesToMoveUp));
    }
    this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
    this.renderBuffer.write(ansi.SAVE_CURSOR);
    this.savedCursorPosition = true;
    if (context) {
      this.logToFile(`[renderNow] Saved cursor at top-left ${context}`);
    } else {
      this.logToFile(`[renderNow] Saved cursor at top-left of region (linesToRender=${linesToRender})`);
    }
  }

  /**
   * Check if content has changed between previous and pending frames
   */
  private hasContentChanged(): { contentChanged: boolean; heightChanged: boolean } {
    const contentChanged = this.previousFrame.length !== this.pendingFrame.length ||
      this.previousFrame.some((line, i) => {
        const prevLine = this.stripAnsi(line);
        const pendingLine = this.stripAnsi(this.pendingFrame[i] ?? '');
        if (prevLine !== pendingLine) {
          // Log the first difference found for debugging
          if (i < 5) { // Only log first few differences to avoid spam
            this.logToFile(`[hasContentChanged] Difference at index ${i}: prev="${prevLine.substring(0, 40)}" vs pending="${pendingLine.substring(0, 40)}"`);
          }
          return true;
        }
        return false;
      });
    const heightChanged = this.height !== this.lastRenderedHeight;
    return { contentChanged, heightChanged };
  }

  /**
   * Expand region to accommodate more lines
   */
  private expandTo(newHeight: number): void {
    this.logToFile(`[expandTo] CALLED: oldHeight=${this.height} newHeight=${newHeight} lastRenderedHeight=${this.lastRenderedHeight} isInitialized=${this.isInitialized} disableRendering=${this.disableRendering}`);
    const oldHeight = this.height;
    this.height = newHeight;

    // Expand pending frame
    while (this.pendingFrame.length < newHeight) {
      this.pendingFrame.push('');
    }

    // CRITICAL: Only expand previousFrame if we're actually rendering
    // previousFrame should represent what was actually rendered, not what we plan to render
    // If disableRendering=true, we haven't rendered yet, so don't expand previousFrame
    // This prevents false negatives in content-change detection
    if (!this.disableRendering) {
      while (this.previousFrame.length < newHeight) {
        this.previousFrame.push('');
      }
    }

    // If we need more lines and region is initialized, reserve additional space
    // CRITICAL: Only expand if height actually increased AND we haven't already expanded to this height
    // This prevents writing newlines multiple times on resize when height hasn't changed
    if (this.isInitialized && newHeight > oldHeight) {
      // Only write newlines if rendering is enabled
      if (!this.disableRendering) {
        const terminalHeight = this.getTerminalHeight();
        const additionalLines = newHeight - oldHeight;
        
        // CRITICAL: Only print newlines if the region still fits in viewport
        // If region already exceeds viewport, terminal will scroll naturally when we write content
        // Printing newlines when region exceeds viewport creates blank lines that aren't cleared
        // CRITICAL: Also check if we've already rendered at this height to prevent duplicate newlines
        this.logToFile(`[expandTo] oldHeight=${oldHeight} newHeight=${newHeight} lastRenderedHeight=${this.lastRenderedHeight} condition=${oldHeight < terminalHeight && this.lastRenderedHeight < newHeight}`);
        if (oldHeight < terminalHeight && this.lastRenderedHeight < newHeight) {
          // Region still fits (or just exceeded) AND we haven't already rendered at this height
          // Print newlines to reserve space
          this.logToFile(`[expandTo] WRITING ${additionalLines} newlines`);
          for (let i = 0; i < additionalLines; i++) {
            this.stdout.write('\n');
          }
          // After printing newlines, cursor is at the start of the line after the new region
          // Move up one line to get to the start of the last line
          // Note: After rendering (when there's content), we save at the END of content
          // But for expansion, we're creating empty lines, so start of line is appropriate
          if (newHeight > 0) {
            this.stdout.write(ansi.moveCursorUp(1));
          }
          this.stdout.write(ansi.MOVE_TO_START_OF_LINE);
          // Re-save cursor position at the new end of the region
          this.stdout.write(ansi.SAVE_CURSOR);
          this.savedCursorPosition = true;
          
          // CRITICAL: Only update lastRenderedHeight AFTER actually writing newlines
          // This ensures renderNow() knows whether newlines were actually written
          this.logToFile(`[expandTo] UPDATING lastRenderedHeight from ${this.lastRenderedHeight} to ${newHeight} (after writing newlines)`);
          this.lastRenderedHeight = newHeight;
        } else {
          // Region already exceeds viewport: don't print newlines or move cursor
          // The terminal will scroll naturally when we write content during rendering
          // Avoid cursor movements here to allow user scrolling
          // The saved cursor position will be updated during the next render
          // No cursor movements needed - just let rendering handle it naturally
        }
      } else {
        this.logToFile(`[expandTo] Skipping newline writes because disableRendering=true`);
        // CRITICAL: Update lastRenderedHeight even when disableRendering=true
        // The height has actually changed, so we need to track it to prevent false positives
        // in the content-change detection. renderNow() will still write newlines when needed
        // because it checks if height increased from lastRenderedHeight.
        // However, if content hasn't changed, we should skip the render to prevent duplicates.
        this.logToFile(`[expandTo] UPDATING lastRenderedHeight from ${this.lastRenderedHeight} to ${newHeight} (height changed, but not writing newlines yet)`);
        this.lastRenderedHeight = newHeight;
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
      // CRITICAL: Don't copy pendingFrame to previousFrame when disableRendering=true
      // previousFrame should represent what was actually rendered, not what we plan to render
      // If we copy here, content-change detection will fail because previousFrame will match pendingFrame
      // The copy will happen after actual rendering in renderNow() or copyPendingToPrevious()
      return;
    }

    if (this.throttle.shouldRender()) {
      // Note: renderNow() is async but we don't await here - it's scheduled via throttle
      // The actual render will happen asynchronously
      void this.renderNow();
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
  private async renderNow(): Promise<void> {
    if (this.disableRendering) {
      this.copyPendingToPrevious();
      return;
    }

    // CRITICAL: Prevent concurrent renders
    // If we're already rendering, skip this render (the current render will show the latest state)
    if (this.isRendering) {
      return;
    }

    this.isRendering = true;

    try {
      // CRITICAL: Ensure region is initialized before rendering
      // Await initialization if it's in progress (this ensures cursor query completes and stdin is restored)
      if (!this.isInitialized && this.initializationPromise) {
        await this.initializationPromise;
      } else if (!this.isInitialized) {
        // Shouldn't happen, but fallback
        await this.initializeRegion();
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

      // CRITICAL: Check if content has actually changed before rendering
      // This prevents unnecessary re-renders that cause duplicates
      const { contentChanged, heightChanged } = this.hasContentChanged();
      
      // Log detailed comparison to understand why content is changing
      if (contentChanged && this.hasRendered) {
        const firstDiffIndex = this.previousFrame.findIndex((line, i) => {
          const prevLine = this.stripAnsi(line);
          const pendingLine = this.stripAnsi(this.pendingFrame[i] ?? '');
          return prevLine !== pendingLine;
        });
        const prevLine = firstDiffIndex >= 0 ? this.stripAnsi(this.previousFrame[firstDiffIndex]) : 'N/A';
        const pendingLine = firstDiffIndex >= 0 ? this.stripAnsi(this.pendingFrame[firstDiffIndex] ?? '') : 'N/A';
        this.logToFile(`[renderNow] contentChanged=true (first diff at index ${firstDiffIndex})`);
        this.logToFile(`[renderNow]   prev[${firstDiffIndex}]: "${prevLine.substring(0, 80)}..."`);
        this.logToFile(`[renderNow]   pending[${firstDiffIndex}]: "${pendingLine.substring(0, 80)}..."`);
      }
      
      this.logToFile(`[renderNow] contentChanged=${contentChanged} heightChanged=${heightChanged} previousFrame.length=${this.previousFrame.length} pendingFrame.length=${this.pendingFrame.length} resizeJustHappened=${this.resizeJustHappened}`);
      
      // CRITICAL: Skip render if content and height haven't changed (unless it's the first render)
      // If only height changed but content hasn't, we still need to render to write newlines
      // for the new lines. But if both are unchanged, we can skip.
      if (this.hasRendered && !contentChanged && !heightChanged) {
        // Content and height are static - skip render to prevent duplicates
        this.logToFile(`[renderNow] SKIPPING render - content and height unchanged`);
        this.isRendering = false;
        return;
      }
      
      // If content hasn't changed but height changed, we still need to render
      // to write newlines for the new lines, but we can optimize by not re-rendering
      // existing lines that haven't changed. However, for simplicity, we'll render
      // everything and let the newline logic handle it.
      
      // If resize happened, reset the flag after we've checked content
      if (this.resizeJustHappened) {
        this.logToFile(`[renderNow] NOT skipping render - contentChanged=${contentChanged} heightChanged=${heightChanged}`);
      }

      // Hide cursor in render buffer too (for consistency)
      this.renderBuffer.write(ansi.HIDE_CURSOR);

      // CRITICAL: When region exceeds viewport, we can only render visible lines
      // Get terminal height to determine which lines are visible
      const terminalHeight = this.getTerminalHeight();
      const regionExceedsViewport = this.height > terminalHeight;
      
      // CRITICAL: On first render (!hasRendered), we're already at the end of the region from initializeRegion().
      // On resize (resizeJustHappened), we need to restore to saved position to get back to the region.
      // On subsequent normal renders, restore to saved position UNLESS region exceeds viewport.
      // When region exceeds viewport, the saved position is in scrollback, and restoring
      // then moving up would cause us to write outside the region.
      if (!this.hasRendered) {
        // First render - we're at the start of the last line from initializeRegion()
        // CRITICAL: We know the region starts at startRow (absolute terminal row)
        // After initialization, we're at startRow + height (the line after the region)
        // We need to position to startRow to begin rendering
        this.logToFile(`[renderNow] First render - region starts at terminal row ${this.startRow}, currently at row ${this.startRow !== null ? this.startRow + this.height : 'unknown'} (after initialization)`);
        
        // CRITICAL: Only write a newline at the bottom if the region exceeds viewport
        // If region fits in viewport, just move up to the first line and paint
        // The newline-at-bottom logic is only needed when expanding past viewport
        if (regionExceedsViewport) {
          // Region exceeds viewport: we need to render only the visible lines (last terminalHeight lines)
          // Calculate which lines are visible
          const visibleStartLineIndex = this.height - terminalHeight;
          this.logToFile(`[renderNow] First render - region exceeds viewport, rendering only visible lines (startLineIndex=${visibleStartLineIndex}, linesToRender=${terminalHeight})`);
          // Write newline at bottom first to scroll everything up
          // This ensures we're not overwriting anything above the region
          this.renderBuffer.write('\n');
          // After writing newline, we're at startRow + height (one line below the region)
          // We want to position to startRow + visibleStartLineIndex (start of visible region)
          // So we need to move up: (startRow + height) - (startRow + visibleStartLineIndex) = height - visibleStartLineIndex = terminalHeight
          if (terminalHeight > 0) {
            this.renderBuffer.write(ansi.moveCursorUp(terminalHeight));
          }
          this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
          this.logToFile(`[renderNow] After positioning, cursor should be at terminal row ${this.startRow !== null ? this.startRow + visibleStartLineIndex : 'unknown'} (start of visible region)`);
        } else {
          // Region fits in viewport: just move up to the first line and paint
          // We're at the start of the last line (after initialization), so move up (height-1) lines to get to first line
          // This should position us at startRow
          this.logToFile(`[renderNow] First render - region fits in viewport, moving up to first line and painting`);
          this.logToFile(`[renderNow] Currently at start of last line (line ${this.height}), moving up ${this.height > 1 ? this.height - 1 : 0} lines to get to first line`);
          if (this.height > 1) {
            this.renderBuffer.write(ansi.moveCursorUp(this.height - 1));
          }
          this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
          this.logToFile(`[renderNow] After positioning, cursor should be at terminal row ${this.startRow} (start of region)`);
        }
        // Don't save cursor here - we'll save it at the top-left after rendering
        // This ensures the saved position is at the top-left, not at the end
      } else if (this.resizeJustHappened) {
        // After resize - DON'T restore cursor position because it might be invalid
        // The terminal may have scrolled or the viewport changed, making the saved
        // position wrong. Instead, we'll position from the current location or use
        // relative movements. The actual positioning will happen in the region-exceeds-viewport
        // or region-fits logic below.
        this.logToFile(`[renderNow] After resize - NOT restoring cursor (position may be invalid, will recalculate)`);
        // Don't restore cursor - let the positioning logic below handle it
        // This prevents writing content in the wrong place
        // CRITICAL: Mark that we just had a resize so positioning logic knows not to restore cursor
        // We'll reset this flag after positioning is done
        // CRITICAL: On resize, we need to re-initialize positioning, but DON'T reset lastRenderedHeight
        // We need to keep the previous height so we can correctly calculate if height increased
        // Only write newlines if height actually increased from before resize
        // NOTE: Don't reset resizeJustHappened yet - we need it for the positioning logic below
        } else {
          // Subsequent renders
          // CRITICAL: Don't use RESTORE_CURSOR - it's unreliable (saved position doesn't match actual position)
          // For region-fits case: the region is always at the bottom of the terminal
          // So we can position by moving to the bottom, then moving up (height) lines
          if (regionExceedsViewport) {
            // For region-exceeds-viewport, we'll handle positioning in the rendering loop
            this.logToFile(`[renderNow] Subsequent render - region exceeds viewport, positioning handled in rendering loop`);
          } else {
            // Region fits: position from bottom of terminal
            // The region is at the bottom, so move to bottom, then up (height) lines to top of region
            this.logToFile(`[renderNow] Subsequent render - region fits, positioning from bottom of terminal`);
            // Move to bottom: write newline to go to next line, then move up 1 to get to last line
            // Actually, better: use absolute positioning to go to (terminalHeight, 1), then move up (height) lines
            // But we don't have terminal height easily available here...
            // Simpler: just don't restore, and let the rendering logic position from current location
            // The rendering loop will handle positioning correctly
            this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
          }
        }
      
      // CRITICAL: If height changed, we need to adjust the saved position
      // But when region exceeds viewport, minimize cursor movements to allow scrolling
      if (this.lastRenderedHeight !== this.height && this.lastRenderedHeight > 0) {
        const heightDiff = this.height - this.lastRenderedHeight;
        const regionExceedsViewport = this.height > terminalHeight;
        
        if (heightDiff > 0) {
          // Height increased: move down to new end using cursor movement (not newlines)
          // But if region exceeds viewport, only move if necessary for visible rendering
          if (!regionExceedsViewport || this.lastRenderedHeight < terminalHeight) {
            // Only move cursor if we're still within viewport or just exceeded it
            this.renderBuffer.write(ansi.moveCursorDown(heightDiff));
            // Re-save the corrected position
            this.renderBuffer.write(ansi.SAVE_CURSOR);
          }
          // If region already exceeded viewport, don't move cursor - let rendering handle it
        } else if (heightDiff < 0) {
          // Height decreased: move up to new end
          this.renderBuffer.write(ansi.moveCursorUp(-heightDiff));
          // Re-save the corrected position
          this.renderBuffer.write(ansi.SAVE_CURSOR);
        }
      }
      
      // Calculate which lines to render:
      // - If region fits in viewport: render all lines (0 to height-1)
      // - If region exceeds viewport: render only visible lines (the last terminalHeight lines)
      //   BUT: Only use startLineIndex > 0 AFTER we've actually scrolled (visibleRegionTopRow is set)
      //   Before scrolling, even if region exceeds viewport, we should render from line 0
      let startLineIndex = 0;
      let linesToRender = Math.min(this.pendingFrame.length, this.height);
      
      if (regionExceedsViewport) {
        // Region exceeds viewport: ALWAYS render only the visible lines (last terminalHeight lines)
        // We should never render from line 0 when the region exceeds the viewport
        // The visible portion is always the last terminalHeight lines of the region
        startLineIndex = this.height - terminalHeight;
        linesToRender = terminalHeight;
        this.logToFile(`[renderNow] Region exceeds viewport: height=${this.height} terminalHeight=${terminalHeight} startLineIndex=${startLineIndex} linesToRender=${linesToRender} (rendering only visible lines)`);
      }
      
      // CRITICAL: Only write newlines when the region GROWS (height increases)
      // This is "dynamic allocation" of lines - we only create new lines when needed
      // If height stays the same or decreases, we just update existing lines without newlines
      // On first render, initializeRegion() already created the lines, so no newlines needed
      // After resize, compare against previous height to see if we need newlines
      // CRITICAL: Only consider height increased if we've rendered before AND height is strictly greater
      // This prevents writing newlines on resize when height hasn't actually changed
      const heightIncreased = this.hasRendered && this.lastRenderedHeight > 0 && this.height > this.lastRenderedHeight;
      const newLinesCount = heightIncreased ? this.height - this.lastRenderedHeight : 0;
      
      // CRITICAL: Defensive check - never write newlines if height didn't actually increase
      // This is a safety measure to prevent duplicates on resize
      // If newLinesCount is 0, we MUST NOT write any newlines, period
      const shouldWriteNewlines = newLinesCount > 0 && heightIncreased;
      
      this.logToFile(`[renderNow] hasRendered=${this.hasRendered} height=${this.height} lastRenderedHeight=${this.lastRenderedHeight} heightIncreased=${heightIncreased} newLinesCount=${newLinesCount} shouldWriteNewlines=${shouldWriteNewlines} resizeJustHappened=${this.resizeJustHappened}`);
      
      // CRITICAL: When region exceeds viewport, we need to render the visible lines
      // Since we're only writing newlines for NEW lines, we need to position correctly
      // BUT: If startLineIndex === 0, we haven't scrolled yet, so use "region fits" positioning
      if (regionExceedsViewport && startLineIndex > 0) {
        // Region exceeds viewport AND we've scrolled: render only the visible lines (last terminalHeight lines)
        // CRITICAL: The saved cursor position is at the top-left of the VISIBLE region (not the entire region)
        // The visible region starts at startLineIndex, so we need to restore and we're already at the right place
        
        // Track current terminal row to detect when we're at the bottom of the viewport
        // Use visibleRegionTopRow if we have it (tracked from previous renders), otherwise estimate
        let currentTerminalRow: number | null = null;
        if (this.visibleRegionTopRow !== null) {
          // We know the terminal row of the top of the visible region from previous renders
          currentTerminalRow = this.visibleRegionTopRow;
          this.logToFile(`[renderNow] Using tracked visibleRegionTopRow=${this.visibleRegionTopRow}`);
        } else {
          // Estimate: if we're rendering the last terminalHeight lines, the top of visible region
          // is at terminal row (terminalHeight - linesToRender + 1)
          currentTerminalRow = terminalHeight - linesToRender + 1;
          this.logToFile(`[renderNow] Estimating currentTerminalRow=${currentTerminalRow} (terminalHeight=${terminalHeight} - linesToRender=${linesToRender} + 1)`);
        }
        
        if (this.resizeJustHappened && this.savedCursorPosition) {
          // After resize, restore saved cursor position (at top-left of visible region)
          this.logToFile(`[renderNow] After resize - RESTORING cursor in region-exceeds-viewport path (at top-left of visible region, startLineIndex=${startLineIndex})`);
          this.renderBuffer.write(ansi.RESTORE_CURSOR);
          // After resize, we don't know the exact position, so estimate
          if (currentTerminalRow === null) {
            currentTerminalRow = terminalHeight - linesToRender + 1;
          }
          // Update tracked position
          this.visibleRegionTopRow = currentTerminalRow;
        } else if (this.savedCursorPosition) {
          // Normal case: restore cursor (at top-left of visible region)
          this.logToFile(`[renderNow] RESTORING cursor (region exceeds viewport, at top-left of visible region, startLineIndex=${startLineIndex})`);
          this.renderBuffer.write(ansi.RESTORE_CURSOR);
          // Update tracked position if we have it, otherwise use estimate
          if (this.visibleRegionTopRow === null) {
            this.visibleRegionTopRow = currentTerminalRow;
          } else {
            currentTerminalRow = this.visibleRegionTopRow;
          }
        } else {
          // No saved position - position from current location
          // Move to start of current line, then move up to get to first visible line
          this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
          if (linesToRender > 1) {
            this.renderBuffer.write(ansi.moveCursorUp(linesToRender - 1));
          }
          this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
          // We don't know the absolute position, so we can't track it
          currentTerminalRow = null;
          this.visibleRegionTopRow = null;
        }
        
        this.logToFile(`[renderNow] Region exceeds viewport: height=${this.height} terminalHeight=${terminalHeight} startLineIndex=${startLineIndex} linesToRender=${linesToRender} currentTerminalRow=${currentTerminalRow ?? 'unknown'} visibleRegionTopRow=${this.visibleRegionTopRow ?? 'null'}`);
        
        // CRITICAL: When region exceeds viewport and we're adding a new line:
        // 1. First, write the top line that will scroll out (so it's in scrollback)
        // 2. Then write the newline at the bottom (this scrolls everything up)
        // 3. Then render the new line content
        // This ensures the top line is written to scrollback before it scrolls out
        
        // CRITICAL: Before writing a newline at the bottom, we need to ensure the top line is written
        // The top line that will scroll out is at startLineIndex (the top of the visible region)
        // We're already at the top, so we can write it right here before the loop
        const lastLineIndex = startLineIndex + linesToRender - 1;
        const isLastLineNew = shouldWriteNewlines && lastLineIndex === (this.height - 1);
        const willScroll = isLastLineNew;
        
        if (willScroll) {
          // We're about to write a newline at the bottom, which will scroll the top line out
          // First, write the top line that will scroll out (so it's in scrollback)
          const topLineIndex = startLineIndex;
          const topLineContent = this.pendingFrame[topLineIndex] || '';
          this.logToFile(`[renderNow] About to write newline at bottom - first writing top line ${topLineIndex + 1} that will scroll out`);
          // We're already at the top of the visible region, so write it here
          this.clearCurrentLine();
          const topContentToWrite = this.truncateContent(topLineContent, this.width);
          this.renderBuffer.write(topContentToWrite);
          // Move to the second line (i=1) where we'll start the loop
          this.renderBuffer.write(ansi.moveCursorDown(1));
          this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
          // We moved down 1 line, so update currentTerminalRow
          if (currentTerminalRow !== null) {
            currentTerminalRow = currentTerminalRow + 1;
          }
        }
        
        // Render from top to bottom
        // CRITICAL: We need to clear each line before writing because we might be updating existing lines
        // If we wrote the top line before the loop (to ensure it's in scrollback), start from i=1
        const loopStart = willScroll ? 1 : 0;
        let actuallyWroteNewlineAtBottom = false;
        for (let i = loopStart; i < linesToRender; i++) {
          const lineIndex = startLineIndex + i;
          const content = this.pendingFrame[lineIndex] || '';
          const isLastLine = (i === linesToRender - 1);
          // CRITICAL: Check if this line is one of the new lines: lineIndex >= (this.height - newLinesCount)
          // Only write newline if region is expanding (shouldWriteNewlines is true)
          const isNewLine = shouldWriteNewlines && lineIndex >= (this.height - newLinesCount);
          
          // Track current terminal row: we're at the row for line i
          // If we started at loopStart, we're at currentTerminalRow + (i - loopStart)
          // But we need to account for the fact that we're already at a certain row when we start
          // Actually, we should track it as: start row + (i - loopStart) for the current line
          // But we don't know the start row exactly... let's track it incrementally
          // When we render line i, we're at row: initialRow + (i - loopStart)
          // But we already updated currentTerminalRow if we wrote the top line, so it's already correct
          // We just need to update it as we move down in the loop
          if (i > loopStart && currentTerminalRow !== null) {
            // We moved down from the previous line
            currentTerminalRow = currentTerminalRow + 1;
          }
          
          // CRITICAL: Always clear the line BEFORE writing
          // This prevents any leftover content from causing duplicates
          this.clearCurrentLine();
          
          // CRITICAL: For new lines at the bottom of viewport, write newline FIRST to trigger scroll,
          // then query cursor to confirm scroll completed (only if we're actually at the bottom),
          // then write content
          // This ensures content is written after scrolling is complete
          if (isNewLine && isLastLine) {
            // CRITICAL: Only query cursor if we're actually at the bottom of the viewport (will trigger scrolling)
            // Check if we're at the bottom BEFORE writing the newline
            // If currentTerminalRow === terminalHeight, writing a newline will take us past the bottom and trigger scrolling
            const isAtBottomOfViewport = currentTerminalRow !== null && currentTerminalRow === terminalHeight;
            
            // New line at the bottom: write newline first to trigger scroll
            this.logToFile(`[renderNow] WRITING newline FIRST for new line ${lineIndex + 1} at bottom (region expanding${isAtBottomOfViewport ? ', will trigger scroll' : ''})`);
            this.renderBuffer.write('\n');
            // Update currentTerminalRow after newline
            if (currentTerminalRow !== null) {
              currentTerminalRow = currentTerminalRow + 1;
            }
            actuallyWroteNewlineAtBottom = true;
            
            if (isAtBottomOfViewport) {
              // CRITICAL: Flush buffer to ensure newline is written before querying
              this.renderBuffer.flush();
              // CRITICAL: Query cursor position to confirm terminal has finished scrolling
              // Terminal scrolling may be asynchronous, so we need to wait for it to complete
              this.logToFile(`[renderNow] At bottom of viewport - querying cursor to confirm scroll completed...`);
              try {
                const pos = await queryCursorPosition(500);
                this.logToFile(`[renderNow] ✓ Cursor query confirmed scroll completed: row=${pos.row}, col=${pos.col}`);
                // After scrolling, we should be at terminalHeight + 1 (below viewport)
                // Move up one to get back to the last visible line
                this.renderBuffer.write(ansi.moveCursorUp(1));
                // CRITICAL: After scrolling, update visibleRegionTopRow
                // After writing newline and moving up 1, we're at the last line of the viewport (row terminalHeight)
                // The visible region spans linesToRender lines, so the top is at terminalHeight - (linesToRender - 1)
                this.visibleRegionTopRow = terminalHeight - (linesToRender - 1);
                this.logToFile(`[renderNow] After scrolling, updated visibleRegionTopRow=${this.visibleRegionTopRow} (terminalHeight=${terminalHeight} - (linesToRender=${linesToRender} - 1))`);
              } catch (err) {
                this.logToFile(`[renderNow] ✗ Cursor query failed: ${err instanceof Error ? err.message : String(err)}, proceeding anyway`);
                // Fallback: just move up and estimate
                this.renderBuffer.write(ansi.moveCursorUp(1));
                this.visibleRegionTopRow = terminalHeight - (linesToRender - 1);
              }
            } else {
              // Not at bottom of viewport - just move up to get back to the line
              this.renderBuffer.write(ansi.moveCursorUp(1));
              this.logToFile(`[renderNow] Not at bottom of viewport (currentTerminalRow was ${currentTerminalRow !== null ? currentTerminalRow - 1 : 'null'}), moved up 1 to get back to line`);
            }
          }
          
          // CRITICAL: Trust the grid layout system - it should ensure content fits within width
          // The grid layout calculates column widths based on availableWidth and ensures content fits
          // Truncation here would cut off content (like progress bar percentages) unnecessarily
          // Only truncate if content is significantly longer (more than 2 chars) as a safety measure
          // This accounts for potential rounding errors or edge cases
          const contentToWrite = this.truncateContent(content, this.width);
          
          // Write content (truncated only if significantly too long)
          const isFirstLine = lineIndex === 0;
          this.logToFile(`[renderNow] WRITING content for line ${lineIndex + 1} (region line ${lineIndex + 1}/${this.height}, visible line ${i + 1}/${linesToRender}, startLineIndex=${startLineIndex}, isFirstLine=${isFirstLine}): "${contentToWrite.substring(0, 50)}${contentToWrite.length > 50 ? '...' : ''}"`);
          this.renderBuffer.write(contentToWrite);
          
          // CRITICAL: Write newline for new lines that are NOT at the bottom
          // For new lines at the bottom, we already wrote the newline above
          if (isNewLine && !isLastLine) {
            this.logToFile(`[renderNow] WRITING newline for line ${lineIndex + 1} (new line, region expanding, not at bottom)`);
            this.renderBuffer.write('\n');
            // Update currentTerminalRow after newline
            if (currentTerminalRow !== null) {
              currentTerminalRow = currentTerminalRow + 1;
            }
            // For non-last lines, the newline already moved us to the next line, so we're good
          } else if (!isLastLine && !isNewLine) {
            // Not the last line and not a new line: move to next line
            this.renderBuffer.write(ansi.moveCursorDown(1));
            this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
          }
          // After rendering last line, we're at the end of the last line
          // We'll move to top-left after the loop
        }
        
        // After rendering, move to top-left of VISIBLE region and save that position
        // This ensures we always know where the visible region starts for the next render
        const lastRenderedLineIndex = startLineIndex + linesToRender - 1;
        const isLastLineOfRegion = lastRenderedLineIndex === (this.height - 1);
        this.logToFile(`[renderNow] After rendering loop: lastRenderedLineIndex=${lastRenderedLineIndex} (region line ${lastRenderedLineIndex + 1}/${this.height}), isLastLineOfRegion=${isLastLineOfRegion}, actuallyWroteNewlineAtBottom=${actuallyWroteNewlineAtBottom}, terminalHeight=${terminalHeight}`);
        
        // CRITICAL: After writing a newline at the bottom, the terminal scrolled
        // The top of the visible region has moved up by one line
        // So we need to adjust how many lines we move up to get to the top-left
        // If we wrote a newline, we're at the end of the last rendered line
        // The top of the visible region is now (linesToRender - 1) lines up (because it scrolled)
        // So we should move up (linesToRender - 1) lines, not linesToRender lines
        if (actuallyWroteNewlineAtBottom) {
          // We wrote a newline at the bottom, terminal scrolled
          // We're at the end of the last rendered line (which is now below the viewport after scroll)
          // The top of the visible region moved up by 1 line due to the scroll
          // So if we were at row X, we're now at row X+1, and the top moved from row Y to row Y+1
          // We need to move up (linesToRender - 1) lines to get to the new top-left
          this.logToFile(`[renderNow] Wrote newline at bottom of viewport (viewport line ${linesToRender}/${linesToRender}) - terminal scrolled, top of visible region moved up 1 line`);
          this.logToFile(`[renderNow] Moving up ${linesToRender - 1} lines to get to top-left (accounting for scroll)`);
          if (linesToRender > 1) {
            this.renderBuffer.write(ansi.moveCursorUp(linesToRender - 1));
          }
          this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
          // CRITICAL: Flush buffer BEFORE saving cursor so all movements are executed
          this.renderBuffer.flush();
          // Write SAVE_CURSOR directly to stdout (not buffer) so it executes immediately
          this.stdout.write(ansi.SAVE_CURSOR);
          this.savedCursorPosition = true;
          this.logToFile(`[renderNow] Saved cursor at top-left of visible region (startLineIndex=${startLineIndex + 1} after scroll)`);
        } else {
          // No newline written, normal case - move up (linesToRender - 1) lines
          this.logToFile(`[renderNow] No newline written at bottom - normal case, moving up ${linesToRender - 1} lines`);
          this.moveToTopLeftAndSave(linesToRender, `of visible region (startLineIndex=${startLineIndex})`);
        }
      } else {
        // Region fits in viewport
        // CRITICAL: Don't use RESTORE_CURSOR - it's unreliable
        // Use relative positioning from current cursor location
        // We're at the start of the last line of the region (after initialization or previous render)
        // Move up (height-1) lines to get to the top of the region
        this.logToFile(`[renderNow] Region fits - using relative positioning from current location (moving up ${this.height > 1 ? this.height - 1 : 0} lines)`);
        this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
        if (this.height > 1) {
          this.renderBuffer.write(ansi.moveCursorUp(this.height - 1));
        }
        
        // Now render each visible line, one at a time
        // CRITICAL: Only write newlines for NEW lines (when height increased)
        // For existing lines, just update them with cursor movement
        this.logToFile(`[renderNow] Starting to write content to buffer (${linesToRender} lines, startRow=${this.startRow}, timestamp: ${new Date().toISOString()})`);
        for (let i = 0; i < linesToRender; i++) {
          const lineIndex = startLineIndex + i;
          const content = this.pendingFrame[lineIndex] || '';
          
          // CRITICAL: Always clear the line BEFORE writing
          // This prevents any leftover content from causing duplicates
          this.clearCurrentLine();
          
          // CRITICAL: Trust the grid layout system - it should ensure content fits within width
          // The grid layout calculates column widths based on availableWidth and ensures content fits
          // Truncation here would cut off content (like progress bar percentages) unnecessarily
          // Only truncate if content is significantly longer (more than 2 chars) as a safety measure
          // This accounts for potential rounding errors or edge cases
          const contentToWrite = this.truncateContent(content, this.width);
          
          // Write content (truncated only if significantly too long)
          const plainContentLength = this.stripAnsi(contentToWrite).length;
          this.logToFile(`[renderNow] WRITING content for line ${lineIndex + 1}: "${contentToWrite.substring(0, 50)}${contentToWrite.length > 50 ? '...' : ''}"`);
          this.logToFile(`[renderNow] Content length: ${plainContentLength} chars, region width: ${this.width}, terminal width: ${getTerminalWidth() + 1} (region width is terminal_width - 1)`);
          // Check if content contains newline (shouldn't happen, but let's log it)
          if (contentToWrite.includes('\n')) {
            this.logToFile(`[renderNow] WARNING: Content for line ${lineIndex + 1} contains newline character!`);
          }
          // Check if content fills the entire width (shouldn't happen, but let's log it)
          if (plainContentLength >= this.width) {
            this.logToFile(`[renderNow] WARNING: Content for line ${lineIndex + 1} fills or exceeds region width! Length: ${plainContentLength}, Width: ${this.width}`);
          }
          this.renderBuffer.write(contentToWrite);
          this.logToFile(`[renderNow] After writing line ${lineIndex + 1}, cursor should be at END of line ${lineIndex + 1}`);
          
          // CRITICAL: Only write newline if this is a NEW line (region grew)
          // For existing lines, just move cursor down without newline
          // Check if this line is one of the new lines: lineIndex >= (this.height - newLinesCount)
          const isNewLine = shouldWriteNewlines && lineIndex >= (this.height - newLinesCount);
          
          if (i < linesToRender - 1) {
            // Not the last line: move to next line
            if (isNewLine) {
              // This is one of the new lines: write newline to create it
              this.logToFile(`[renderNow] WRITING newline for line ${lineIndex + 1} (new line, region expanding)`);
              this.renderBuffer.write('\n');
            } else {
              // This is an existing line: just move cursor down
              this.logToFile(`[renderNow] Moving cursor DOWN 1 line from line ${lineIndex + 1} to line ${lineIndex + 2}`);
              this.renderBuffer.write(ansi.moveCursorDown(1));
              this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
              this.logToFile(`[renderNow] After moving down, cursor should be at START of line ${lineIndex + 2}`);
            }
          } else {
            // Last line of visible region
            if (isNewLine) {
              // The last line is a new line: always write newline when region is expanding
              this.logToFile(`[renderNow] WRITING newline for last line ${lineIndex + 1} (new line, region expanding)`);
              this.renderBuffer.write('\n');
              // After newline, if we're at the bottom of viewport, terminal scrolled
              // Move up one to get back to the last visible line
              if (regionExceedsViewport) {
                this.renderBuffer.write(ansi.moveCursorUp(1));
                // CRITICAL: Flush buffer to ensure terminal has finished scrolling before we continue
                // Terminal scrolling may be asynchronous, so we need to wait for it to complete
                this.renderBuffer.flush();
                this.logToFile(`[renderNow] After writing newline for last line, moved up 1 to get back to last line (terminal scrolled, flushed buffer to ensure scroll completed)`);
                // CRITICAL: After scrolling, set visibleRegionTopRow so next render uses startLineIndex > 0
                const estimatedTopRow = terminalHeight - this.height + 1;
                this.visibleRegionTopRow = estimatedTopRow;
                this.logToFile(`[renderNow] After scrolling, estimated visibleRegionTopRow=${this.visibleRegionTopRow} (terminalHeight=${terminalHeight} - height=${this.height} + 1)`);
              }
            } else {
              // Last line, but not a new line
              this.logToFile(`[renderNow] Last line ${lineIndex + 1} is not new, cursor is at END of line (no newline written)`);
            }
            // After rendering last line, we're at the end of the last line
            // We'll move to top-left after the loop
          }
        }
        
        // After rendering, move to top-left of region
        // CRITICAL: Flush buffer FIRST so all cursor movements are executed
        // Then save the cursor position at the actual location
        this.logToFile(`[renderNow] About to moveToTopLeftAndSave: linesToRender=${linesToRender}, we should be at END of last line`);
        
        // Move to top-left and save cursor position (for our internal tracking)
        const linesToMoveUp = linesToRender > 1 ? linesToRender - 1 : 0;
        this.logToFile(`[moveToTopLeftAndSave] linesToRender=${linesToRender}, moving up ${linesToMoveUp} lines to get to top-left (after rendering, cursor is at end of last line)`);
        if (linesToMoveUp > 0) {
          this.renderBuffer.write(ansi.moveCursorUp(linesToMoveUp));
        }
        this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
        
        // Flush buffer NOW so cursor movements are executed
        this.logToFile(`[renderNow] FLUSHING buffer to stdout (startRow=${this.startRow}, timestamp: ${new Date().toISOString()})`);
        this.renderBuffer.flush();
        
        // NOW save the cursor position at top-left (after all movements are executed)
        // Write directly to stdout (not buffer) so it executes immediately
        this.stdout.write(ansi.SAVE_CURSOR);
        this.savedCursorPosition = true;
        this.logToFile(`[renderNow] Saved cursor at top-left of region (linesToRender=${linesToRender}, startRow=${this.startRow})`);
        
        // CRITICAL: Move the VISIBLE cursor to the line AFTER the region (below it)
        // This prevents user input from overwriting the region content
        // We saved the position at top-left for our internal tracking, but the visible cursor should be out of the way
        this.stdout.write(ansi.moveCursorDown(linesToRender));
        this.stdout.write(ansi.MOVE_TO_START_OF_LINE);
        this.stdout.write(ansi.SHOW_CURSOR);
        this.logToFile(`[renderNow] Moved visible cursor DOWN ${linesToRender} lines to position AFTER region (so user input won't interfere)`);
      }
      
      // Handle deletions (lines that were in previousFrame but not in pendingFrame)
      // Since we've already cleared and re-rendered all lines, deletions are handled
      // by the fact that those lines are no longer in pendingFrame
      // No additional action needed - the lines are already cleared
      
      // CRITICAL: After rendering, we've saved the cursor at the top-left of the region
      // This ensures we always know where the region starts for the next render
      // The cursor position is saved at the first line, start of line, of the region
      // This is more reliable than saving at the end, especially after resize/scroll

      // Copy pending to previous
      this.copyPendingToPrevious();
      
      // Update last rendered height for next render
      this.lastRenderedHeight = this.height;
      this.hasRendered = true; // Mark that we've rendered at least once
      
      // CRITICAL: Reset resize flag after rendering is complete
      // This ensures the flag is only active during the render that handles the resize
      if (this.resizeJustHappened) {
        this.logToFile(`[renderNow] RESETTING resizeJustHappened=false (after render complete)`);
        this.resizeJustHappened = false;
      }

      this.renderScheduled = false;
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Force immediate render of pending updates (bypasses throttle)
   * Returns a promise that resolves when rendering is complete
   */
  async flush(): Promise<void> {
    // CRITICAL: Await initialization before rendering
    // This ensures cursor query completes and stdin is restored before any rendering
    if (!this.isInitialized && this.initializationPromise) {
      await this.initializationPromise;
    }
    await this.renderNow();
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
    // CRITICAL: Disable rendering during clear to prevent multiple renders
    // We'll render once at the end if needed
    const wasRenderingDisabled = this.disableRendering;
    this.disableRendering = true;
    
    // Clear all lines in pendingFrame (which may be larger than height if region expanded)
    const maxLines = Math.max(this.height, this.pendingFrame.length);
    for (let i = 1; i <= maxLines; i++) {
      this.setLine(i, '');
    }
    
    // Re-enable rendering
    this.disableRendering = wasRenderingDisabled;
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
  async destroy(clearFirst: boolean = false): Promise<void> {
    // CRITICAL: Mark as destroyed FIRST to prevent resize handler from interfering
    // This ensures resize handler won't re-disable auto-wrap after we re-enable it
    const wasInitialized = this.isInitialized;
    this.isInitialized = false;
    
    // Remove from active regions set (prevent memory leak)
    RegionRenderer.activeRegions.delete(this);
    
    // Re-enable terminal auto-wrap if we disabled it
    // Write directly to stdout to ensure it takes effect immediately
    // CRITICAL: Always re-enable auto-wrap on destroy to prevent zsh/terminal issues
    // When auto-wrap is disabled and terminal resizes, zsh may insert lines
    if (!this.disableRendering && this.autoWrapDisabled) {
      this.stdout.write(ansi.ENABLE_AUTO_WRAP);
      this.autoWrapDisabled = false;
    }
    
    // Prevent double-destruction
    if (!wasInitialized && this.pendingFrame.length === 0) {
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
      await this.renderNow();
    }

    if (!this.disableRendering && wasInitialized) {
      // Check if all lines are blank
      // After clearFirst + renderNow(), previousFrame will have empty lines
      // Otherwise, check previousFrame to see if content exists
      const allLinesBlank = this.previousFrame.every(line => line.trim() === '');
      
      // Only delete lines if they are blank
      // If clearFirst was true, we've already cleared and rendered, so previousFrame will be empty
      // If clearFirst was false, we check previousFrame to see if content exists
      if (allLinesBlank && this.height > 0) {
        // CRITICAL: Don't use RESTORE_CURSOR here - it might be invalid after destroy
        // Instead, just move to the end of the region using relative movement
        // We know we're at the end because that's where we save the cursor
        
        // Move to start of first line of region (go up by height)
        this.renderBuffer.write(ansi.moveCursorUp(this.height));
        // Use MOVE_TO_START_OF_LINE which is more reliable than \r
        this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);

        // Delete the blank lines (shifts content up if supported)
        // This will remove the lines from the terminal display
        this.renderBuffer.write(ansi.deleteLines(this.height));

        // Flush the cleanup
        this.renderBuffer.flush();
      }
      
      // CRITICAL: Clear any saved cursor position to prevent zsh from restoring it
      // Some terminals/shells (like zsh) may try to restore saved cursor positions
      // We don't want to leave a stale saved position that could cause issues
      // Note: There's no standard ANSI code to "clear" saved position, but we can
      // ensure we're at a known position and not relying on saved position
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

