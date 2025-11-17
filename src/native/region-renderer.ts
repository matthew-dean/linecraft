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
  private readonly permanentlyDisabled: boolean;
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
    this.permanentlyDisabled = options.disableRendering ?? false;
    this.disableRendering = this.permanentlyDisabled;
    this.onKeepAlive = options.onKeepAlive;

    // Initialize frames with empty lines
    this.pendingFrame = Array(this.height).fill('');
    this.previousFrame = Array(this.height).fill('');

    this.throttle = new Throttle(60); // Default 60 FPS
    this.renderBuffer = new RenderBuffer(this.stdout);

    // Reserve space for the region by printing newlines
    // Start initialization async (but don't await - it will be awaited on first flush)
    if (!this.permanentlyDisabled) {
      this.initializationPromise = this.initializeRegion();
    }

    // Set up resize handling if width was not explicitly set (auto-resize enabled)
    if (!this.widthExplicitlySet && !this.permanentlyDisabled) {
      this.setupResizeHandler();
    }

    // Set up automatic cleanup on process exit
    // This ensures regions are properly cleaned up even if destroy() isn't called
    // Use singleton pattern to prevent memory leak from multiple listeners
    if (!this.permanentlyDisabled) {
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
        
        // CRITICAL: Always re-disable auto-wrap on resize if region is initialized
        // Some terminals reset auto-wrap state on resize, so we must re-disable it
        // This ensures content doesn't reflow automatically when terminal resizes
        // Write directly to stdout since this happens outside of render cycle
        if (!this.disableRendering && this.isInitialized) {
          this.stdout.write(ansi.DISABLE_AUTO_WRAP);
          this.autoWrapDisabled = true;
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
        
        // SIMPLE APPROACH: On resize, clear screen and start at top
        // We can't rely on cursor position after resize, so take over completely
        this.logToFile(`[resize handler] Resize detected - clearing screen and resetting to top`);
        this.resizeJustHappened = true;
        
        // Clear the entire terminal screen
        this.stdout.write(ansi.ERASE_SCREEN);
        this.stdout.write(ansi.moveCursorTo(1, 1));
        
        // Reset region position to top of terminal
        this.startRow = 1;
        this.visibleRegionTopRow = 1;
        this.savedCursorPosition = false;
        
        // Trigger re-render
        if (this.onKeepAlive) {
          this.logToFile(`[resize handler] Calling onKeepAlive() to trigger re-render at top of screen`);
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
        
        // CRITICAL: Always re-disable auto-wrap on resize if region is initialized
        // Some terminals reset auto-wrap state on resize, so we must re-disable it
        // This ensures content doesn't reflow automatically when terminal resizes
        // Write directly to stdout since this happens outside of render cycle
        if (!this.disableRendering && this.isInitialized) {
          this.stdout.write(ansi.DISABLE_AUTO_WRAP);
          this.autoWrapDisabled = true;
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
        
        // SIMPLE APPROACH: On resize, clear screen and start at top
        // We can't rely on cursor position after resize, so take over completely
        this.logToFile(`[resize handler] Resize detected - clearing screen and resetting to top`);
        this.resizeJustHappened = true;
        
        // Clear the entire terminal screen
        this.stdout.write(ansi.ERASE_SCREEN);
        this.stdout.write(ansi.moveCursorTo(1, 1));
        
        // Reset region position to top of terminal
        this.startRow = 1;
        this.visibleRegionTopRow = 1;
        this.savedCursorPosition = false;
        
        // Trigger re-render
        if (this.onKeepAlive) {
          this.logToFile(`[resize handler] Calling onKeepAlive() to trigger re-render at top of screen`);
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
    // Try to query even if TTY check suggests it might not work - queryCursorPosition will handle errors
    let queriedRow: number | null = null;
    const queryStartTime = Date.now();
    try {
      this.logToFile(`[initializeRegion] QUERYING cursor position before printing newlines (stdin.isTTY=${process.stdin.isTTY}, stdout.isTTY=${process.stdout.isTTY}, timestamp: ${new Date().toISOString()})...`);
      const pos = await queryCursorPosition(500);
      const queryEndTime = Date.now();
      const queryDuration = queryEndTime - queryStartTime;
      queriedRow = pos.row;
      // CRITICAL: Start the region at the cursor position
      // The cursor is at the prompt line, so we start the region at that same row
      // BUT: Cap startRow to ensure it fits within the terminal viewport
      const terminalHeight = this.getTerminalHeight();
      const desiredStartRow = pos.row;
      // CRITICAL: Ensure startRow doesn't exceed terminal height
      // If the cursor is already near the bottom, start from a position that allows the region to fit
      // We need at least `this.height` lines, so startRow should be at most (terminalHeight - this.height + 1)
      const maxStartRow = Math.max(1, terminalHeight - this.height + 1);
      this.startRow = Math.min(desiredStartRow, maxStartRow);
      this.logToFile(`[initializeRegion] ✓ GOT cursor position back: row=${pos.row}, col=${pos.col}, desiredStartRow=${desiredStartRow}, maxStartRow=${maxStartRow}, setting startRow=${this.startRow} (capped to fit in viewport, query took ${queryDuration}ms, timestamp: ${new Date().toISOString()})`);
      // CRITICAL: At this point, queryCursorPosition has cleaned up and restored stdin
      // stdin should be in a clean state for waitForSpacebar
    } catch (err) {
      const queryEndTime = Date.now();
      const queryDuration = queryEndTime - queryStartTime;
      // Query failed - use a reasonable default (start a few lines from top to avoid overwriting command output)
      // We can't know the exact cursor position, so use a conservative estimate
      this.startRow = 3; // Start at row 3 to leave room for command output
      this.logToFile(`[initializeRegion] ✗ Cursor query FAILED after ${queryDuration}ms: ${err instanceof Error ? err.message : String(err)}, using fallback startRow=${this.startRow} (timestamp: ${new Date().toISOString()})`);
    }
    
    this.isInitialized = true;

    // CRITICAL: Position to startRow before printing newlines
    // We queried the cursor position and set startRow = queriedRow (or capped if needed)
    // After query cleanup, the cursor should still be at approximately the queried position
    // So we need to move down (startRow - queriedRow) lines to get to startRow (if startRow > queriedRow)
    if (queriedRow !== null) {
      const linesToMoveDown = this.startRow - queriedRow;
      if (linesToMoveDown > 0) {
        this.stdout.write(ansi.moveCursorDown(linesToMoveDown));
        this.logToFile(`[initializeRegion] Moved down ${linesToMoveDown} lines to position at startRow=${this.startRow} (queriedRow=${queriedRow})`);
      } else if (linesToMoveDown === 0) {
        this.logToFile(`[initializeRegion] Already at startRow=${this.startRow} (queriedRow=${queriedRow}), no movement needed`);
      }
    }
    
    // Reserve space by printing newlines (this moves cursor down AND scrolls the terminal)
    // Each newline reserves one line for the region
    //
    // CRITICAL: Predict scrolling by tracking logical cursor position
    // Scrolling happens when we print a newline while cursor is on the last visible row
    // We predict it, we don't detect it - treat terminal as a 2D framebuffer
    //
    // Get CURRENT terminal height just before writing newlines
    // (not initial height, in case terminal was resized)
    const terminalHeight = this.getTerminalHeight();
    const initialStartRow = this.startRow; // Where we start printing newlines (from cursor query)
    let scrolls = 0;
    let currentRow = initialStartRow;
    
    // For each newline we print, predict if it will cause a scroll
    // Rule: When logical cursor line index >= terminal rows, we've overflowed and forced a scroll
    for (let i = 0; i < this.height; i++) {
      // Check BEFORE printing: if we're at or past the bottom row, newline will cause scroll
      if (currentRow >= terminalHeight) {
        // We're at the last visible row (or past it), printing newline will cause scroll
        // After scroll: content moves up by 1 row, cursor stays at terminalHeight
        scrolls++;
        currentRow = terminalHeight; // Cursor stays at bottom after scroll
      } else {
        // We're not at bottom yet, newline just moves cursor down
        currentRow++;
      }
      this.stdout.write('\n');
    }
    
    // After printing all newlines, adjust startRow based on scrolling
    // Each scroll moves the original content up by 1 row in the viewport
    // So: startRow = initialStartRow - scrolls
    // This keeps startRow based on the cursor query, just adjusted for scrolling
    const oldStartRow = this.startRow;
    this.startRow = initialStartRow - scrolls;
    this.logToFile(`[initializeRegion] After printing ${this.height} newlines: initialStartRow=${initialStartRow} (from cursor query), currentTerminalHeight=${terminalHeight}, scrolls=${scrolls}, adjusted startRow=${this.startRow} (was ${oldStartRow}, region moved UP ${scrolls} rows due to scrolling)`);

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
    // FIXED: Use (linesToRender - 1) as per the working fix
    const linesToMoveUp = linesToRender > 1 ? linesToRender - 1 : 0;
    this.logToFile(`[moveToTopLeftAndSave] linesToRender=${linesToRender}, moving up ${linesToMoveUp} lines to get to top-left (after rendering, cursor is at end of last line)`);
    if (linesToMoveUp > 0) {
      this.renderBuffer.write(ansi.moveCursorUp(linesToMoveUp));
    }
        this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
        // CRITICAL: Flush buffer BEFORE saving cursor so all movements are executed
        this.renderBuffer.flush();
        // Write SAVE_CURSOR directly to stdout (not buffer) so it executes immediately
        // NOTE: Verification queries disabled - they interfere with stdin
        this.stdout.write(ansi.SAVE_CURSOR);
        this.savedCursorPosition = true;
        if (context) {
          this.logToFile(`[renderNow] Saved cursor at top-left ${context} (will verify with query)`);
        } else {
          this.logToFile(`[renderNow] Saved cursor at top-left of region (linesToRender=${linesToRender}, will verify with query)`);
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
      const terminalHeight = this.getTerminalHeight();
      const additionalLines = newHeight - oldHeight;
      // CRITICAL: If rendering was permanently disabled (tests), never write to stdout
      if (this.permanentlyDisabled) {
        this.logToFile(`[expandTo] Rendering permanently disabled - skipping newline writes but tracking height (${this.lastRenderedHeight} -> ${newHeight})`);
        this.lastRenderedHeight = newHeight;
        return;
      }

      // Even if rendering is temporarily disabled (batching), we still need to reserve space
      // Only print newlines if the region still fits in viewport
      const shouldReserveLines = oldHeight < terminalHeight && this.lastRenderedHeight < newHeight;
      this.logToFile(`[expandTo] oldHeight=${oldHeight} newHeight=${newHeight} lastRenderedHeight=${this.lastRenderedHeight} terminalHeight=${terminalHeight} shouldReserveLines=${shouldReserveLines} disableRendering=${this.disableRendering}`);
      
      // CRITICAL: Predict scrolling correctly
      // Scroll happens ONLY when we write a newline at row = terminalHeight
      // The region ends at: startRow + oldHeight - 1
      // If the region ends at terminalHeight, writing a newline causes scrolling
      if (this.startRow !== null && shouldReserveLines) {
        const oldStartRow = this.startRow;
        const regionEndRow = oldStartRow + oldHeight - 1;
        
        if (regionEndRow >= terminalHeight) {
          // Region ends at or past bottom - writing newline will cause scrolling
          // After scroll, keep region at bottom
          this.startRow = terminalHeight - newHeight + 1;
          this.logToFile(`[expandTo] Updated startRow from ${oldStartRow} to ${this.startRow} (regionEndRow=${regionEndRow} >= terminalHeight=${terminalHeight}, scroll will happen)`);
        } else {
          // Region doesn't reach bottom - no scroll, startRow stays the same
          this.logToFile(`[expandTo] Keeping startRow=${oldStartRow} (regionEndRow=${regionEndRow} < terminalHeight=${terminalHeight}, no scroll)`);
        }
      } else if (this.startRow !== null && !shouldReserveLines) {
        // Not reserving lines (region already exceeds viewport) - just recalculate
        const oldStartRow = this.startRow;
        this.startRow = terminalHeight - newHeight + 1;
        this.logToFile(`[expandTo] Updated startRow from ${oldStartRow} to ${this.startRow} (region height changed from ${oldHeight} to ${newHeight} lines, terminalHeight=${terminalHeight}, no newlines written)`);
      }
      
      if (shouldReserveLines) {
        this.logToFile(`[expandTo] WRITING ${additionalLines} newlines (reserving space even though disableRendering may be ${this.disableRendering})`);
        for (let i = 0; i < additionalLines; i++) {
          this.stdout.write('\n');
        }
        if (newHeight > 0) {
          this.stdout.write(ansi.moveCursorUp(1));
        }
        this.stdout.write(ansi.MOVE_TO_START_OF_LINE);
        this.stdout.write(ansi.SAVE_CURSOR);
        this.savedCursorPosition = true;
        this.logToFile(`[expandTo] UPDATING lastRenderedHeight from ${this.lastRenderedHeight} to ${newHeight} (after writing newlines)`);
        this.lastRenderedHeight = newHeight;
      } else {
        this.logToFile(`[expandTo] Region already exceeds viewport or already reserved at this height - skipping newline writes`);
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
   * Update multiple lines at once (used by SectionReference)
   * This method updates the pendingFrame and schedules a single render
   */
  updateLines(updates: Array<{ lineNumber: number; content: string }>): void {
    if (updates.length === 0) {
      return;
    }

    // Update all lines in pendingFrame
    for (const { lineNumber, content } of updates) {
      if (lineNumber < 1) {
        throw new Error('Line numbers start at 1');
      }

      const lineIndex = lineNumber - 1;

      // Ensure pending frame has enough lines
      while (this.pendingFrame.length <= lineIndex) {
        this.pendingFrame.push('');
      }

      // Update the line
      this.pendingFrame[lineIndex] = content;
    }

    // Schedule a single render for all updates
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

      // CRITICAL: Check if pendingFrame is empty but previousFrame has content
      // This happens when a subsequent render is triggered but components haven't been re-rendered
      // In this case, we need to call onKeepAlive() to re-render all components
      const pendingFrameIsEmpty = this.pendingFrame.length > 0 && this.pendingFrame.every(line => line === '');
      const previousFrameHasContent = this.previousFrame.length > 0 && this.previousFrame.some(line => line !== '');
      
      if (pendingFrameIsEmpty && previousFrameHasContent && this.onKeepAlive && this.hasRendered) {
        this.logToFile(`[renderNow] pendingFrame is empty but previousFrame has content - calling onKeepAlive() to re-render components`);
        this.onKeepAlive();
        // CRITICAL: Return early - onKeepAlive() will trigger a fresh render cycle
        // Don't continue with this render as it would use stale positioning
        this.isRendering = false;
        return;
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
      
      // Track current terminal row as we render (helps detect bottom of viewport)
      // CRITICAL: After positioning cursor, currentTerminalRow will be set to the position we just moved to
      let currentTerminalRow: number | null = null;
      
      // Simple positioning logic:
      // 1. First render: position at startRow and render
      // 2. Resize: position at row 1 (already cleared) and render
      // 3. Subsequent renders: position at startRow and render
      if (this.resizeJustHappened) {
        // After resize - screen was already cleared by resize handler, just position at top
        // startRow is already set to 1 by the resize handler
        this.logToFile(`[renderNow] After resize - screen cleared, positioning at top (startRow=${this.startRow})`);
        
        if (this.startRow !== null) {
          // Position at top of screen (already cleared by resize handler)
          this.renderBuffer.write(ansi.moveCursorTo(1, this.startRow));
          this.visibleRegionTopRow = this.startRow;
          this.renderBuffer.flush();
        } else {
          // Fallback: position at row 1
          this.logToFile(`[renderNow] After resize - WARNING: startRow is null, using row 1 as fallback`);
          this.startRow = 1;
          this.visibleRegionTopRow = 1;
          this.renderBuffer.write(ansi.moveCursorTo(1, 1));
          this.renderBuffer.flush();
        }
      } else {
        // First render or subsequent render - same logic: position at startRow and render
        if (this.startRow === null) {
          throw new Error('startRow is null - this should not happen');
        }
        
        if (regionExceedsViewport) {
          // Region exceeds viewport - calculate which lines are visible
          // If top has scrolled off (startRow <= 1), show last terminalHeight lines starting at row 1
          // Otherwise, show lines starting from startRow
          if (this.startRow <= 1) {
            // Top has scrolled off - position at row 1, show last terminalHeight lines
            const startLineIndex = this.height - terminalHeight;
            this.logToFile(`[renderNow] Region top scrolled off - positioning at row 1, showing last ${terminalHeight} lines (startLineIndex=${startLineIndex})`);
            this.renderBuffer.write(ansi.moveCursorTo(1, 1));
            currentTerminalRow = 1;
            this.visibleRegionTopRow = 1;
          } else {
            // Top hasn't scrolled off yet - position at startRow, show visible lines from start
            const visibleLinesFromStart = terminalHeight - this.startRow + 1;
            this.logToFile(`[renderNow] Region top visible - positioning at startRow=${this.startRow}, showing ${visibleLinesFromStart} lines`);
            this.renderBuffer.write(ansi.moveCursorTo(1, this.startRow));
            currentTerminalRow = this.startRow;
            this.visibleRegionTopRow = this.startRow;
          }
        } else {
          // Region fits - position at startRow
          this.logToFile(`[renderNow] Positioning at startRow=${this.startRow}`);
          this.renderBuffer.write(ansi.moveCursorTo(1, this.startRow));
          currentTerminalRow = this.startRow;
          this.visibleRegionTopRow = this.startRow;
        }
        
        this.renderBuffer.flush();
      }
      
      // CRITICAL: Shared rendering logic - runs for both first render and subsequent renders
      // Calculate which lines to render
      let startLineIndex = 0;
      let linesToRender = Math.min(this.pendingFrame.length, this.height);
      
      if (regionExceedsViewport) {
        // When region exceeds viewport, calculate which lines are visible
        // The region starts at startRow and has height lines
        // The viewport is rows 1 to terminalHeight
        // Calculate how many lines fit in the viewport starting from startRow
        if (this.startRow === null) {
          // Fallback: show the last terminalHeight lines if startRow is not set
          startLineIndex = this.height - terminalHeight;
          linesToRender = terminalHeight;
        } else {
          const visibleLinesFromStart = Math.max(0, terminalHeight - this.startRow + 1);
          if (visibleLinesFromStart >= this.height) {
            // All lines fit in viewport, show all starting from line 0
            startLineIndex = 0;
            linesToRender = this.height;
          } else if (this.startRow <= 1) {
            // Region starts at or above top of viewport, show the last terminalHeight lines
            startLineIndex = this.height - terminalHeight;
            linesToRender = terminalHeight;
          } else {
            // Region starts below top of viewport, show lines that fit from the start
            startLineIndex = 0;
            linesToRender = visibleLinesFromStart;
          }
        }
        if (!this.hasRendered) {
          this.logToFile(`[renderNow] First render - region exceeds viewport, rendering only visible lines (startRow=${this.startRow}, startLineIndex=${startLineIndex}, linesToRender=${linesToRender})`);
        }
      }
      
      // Calculate newline logic
      const heightIncreased = this.hasRendered && this.lastRenderedHeight > 0 && this.height > this.lastRenderedHeight;
      const newLinesCount = heightIncreased ? this.height - this.lastRenderedHeight : 0;
      const shouldWriteNewlines = newLinesCount > 0 && heightIncreased;
      
      this.logToFile(`[renderNow] hasRendered=${this.hasRendered} height=${this.height} lastRenderedHeight=${this.lastRenderedHeight} heightIncreased=${heightIncreased} newLinesCount=${newLinesCount} shouldWriteNewlines=${shouldWriteNewlines}`);
      
      // CRITICAL: When region exceeds viewport and we're adding a new line at bottom:
      // Write the top line that will scroll out BEFORE the loop (so it's in scrollback)
      const lastLineIndex = startLineIndex + linesToRender - 1;
      const isLastLineNew = shouldWriteNewlines && lastLineIndex === (this.height - 1);
      const willScroll = regionExceedsViewport && isLastLineNew && startLineIndex > 0;
      
      if (willScroll) {
        const topLineIndex = startLineIndex;
        const topLineContent = this.pendingFrame[topLineIndex] || '';
        this.logToFile(`[renderNow] ===== WILL_SCROLL BLOCK START =====`);
        this.logToFile(`[renderNow] About to write newline at bottom - first writing top line ${topLineIndex + 1} that will scroll out`);
        this.logToFile(`[renderNow] BEFORE positioning: currentTerminalRow=${currentTerminalRow}, visibleRegionTopRow=${this.visibleRegionTopRow}, terminalHeight=${terminalHeight}`);
        // CRITICAL: Ensure we're positioned at the top of the visible region before writing
        // The cursor should already be there from positioning logic, but verify and fix if needed
        // ALWAYS reposition to be absolutely sure we're at the correct position
        if (this.visibleRegionTopRow !== null) {
          this.logToFile(`[renderNow] MOVING cursor to row ${this.visibleRegionTopRow} (visibleRegionTopRow)`);
          this.renderBuffer.write(ansi.moveCursorTo(1, this.visibleRegionTopRow));
          currentTerminalRow = this.visibleRegionTopRow;
          // CRITICAL: Flush to ensure cursor movement is executed before writing
          this.logToFile(`[renderNow] FLUSHING buffer after cursor move (buffer size before flush: ${this.renderBuffer.size})`);
          this.renderBuffer.flush();
          this.logToFile(`[renderNow] AFTER flush: currentTerminalRow=${currentTerminalRow} (should be ${this.visibleRegionTopRow})`);
        } else {
          this.logToFile(`[renderNow] ERROR: visibleRegionTopRow is null! Cannot position cursor!`);
        }
        // Write the top line that will scroll out at the top of the visible region
        // CRITICAL: Before writing, clear the line above (where region line 0 was from previous render)
        // This prevents region line 1 from appearing at the bottom after scroll
        if (startLineIndex > 0 && currentTerminalRow !== null && currentTerminalRow > 1) {
          this.logToFile(`[renderNow] Clearing line above (row ${currentTerminalRow - 1}) before writing top line to prevent region line 1 from appearing at bottom`);
          this.renderBuffer.write(ansi.moveCursorTo(1, currentTerminalRow - 1));
          this.clearCurrentLine();
          // Move back to where we were
          this.renderBuffer.write(ansi.moveCursorTo(1, currentTerminalRow));
        }
        const topContentToWrite = this.truncateContent(topLineContent, this.width);
        this.logToFile(`[renderNow] ABOUT TO WRITE top line content at currentTerminalRow=${currentTerminalRow}`);
        this.logToFile(`[renderNow] Top line content (first 50 chars): "${topContentToWrite.substring(0, 50)}..."`);
        this.clearCurrentLine();
        this.renderBuffer.write(topContentToWrite);
        // CRITICAL: Reset ANSI codes to prevent color bleed
        this.renderBuffer.write(ansi.RESET);
        this.logToFile(`[renderNow] WROTE top line content, currentTerminalRow=${currentTerminalRow}`);
        // CRITICAL: Move to the bottom of the viewport BEFORE writing newline
        // This ensures the top line we just wrote stays at the top, and the newline scrolls correctly
        this.logToFile(`[renderNow] BEFORE moving to bottom: currentTerminalRow=${currentTerminalRow}, terminalHeight=${terminalHeight}`);
        if (currentTerminalRow !== null) {
          const linesToBottom = terminalHeight - currentTerminalRow;
          this.logToFile(`[renderNow] Moving cursor DOWN ${linesToBottom} lines to reach bottom`);
          if (linesToBottom > 0) {
            this.renderBuffer.write(ansi.moveCursorDown(linesToBottom));
            currentTerminalRow = terminalHeight;
          }
        }
        this.logToFile(`[renderNow] Writing newline at bottom (currentTerminalRow=${currentTerminalRow})`);
        this.renderBuffer.write('\n');
        this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
        if (currentTerminalRow !== null) {
          currentTerminalRow = currentTerminalRow + 1;
        }
        this.logToFile(`[renderNow] After newline: currentTerminalRow=${currentTerminalRow} (scrolled)`);
        // CRITICAL: After writing newline at bottom, terminal scrolled
        // We need to move back to the top of the visible region to start the loop
        // The top line we just wrote is now one line up (scrolled), so visibleRegionTopRow moved up by 1
        if (this.visibleRegionTopRow !== null) {
          const newTopRow = this.visibleRegionTopRow - 1;
          this.visibleRegionTopRow = newTopRow;
          this.logToFile(`[renderNow] After scroll, moving back to top of visible region at row ${newTopRow} (was ${this.visibleRegionTopRow + 1})`);
          this.renderBuffer.write(ansi.moveCursorTo(1, newTopRow));
          currentTerminalRow = newTopRow;
          this.logToFile(`[renderNow] Positioned at newTopRow=${newTopRow}, currentTerminalRow=${currentTerminalRow}`);
        }
        this.logToFile(`[renderNow] ===== WILL_SCROLL BLOCK END =====`);
      }
      
      // Unified rendering loop for both region-fits and region-exceeds-viewport
      const loopStart = willScroll ? 1 : 0;
      let actuallyWroteNewlineAtBottom = willScroll; // Set to true if we already wrote newline in willScroll block
      let wroteNewlineForLastLine = false; // Track if we wrote newline for last line (region-fits case)
      this.logToFile(`[renderNow] ===== MAIN RENDERING LOOP START =====`);
      this.logToFile(`[renderNow] loopStart=${loopStart}, linesToRender=${linesToRender}, startLineIndex=${startLineIndex}, currentTerminalRow=${currentTerminalRow}`);
      if (startLineIndex > 0) {
        this.logToFile(`[renderNow] WARNING: startLineIndex=${startLineIndex} > 0, so region line 0 (first line) will NOT be rendered in this loop!`);
        this.logToFile(`[renderNow] Region line 0 content: "${(this.pendingFrame[0] || '').substring(0, 50)}..."`);
        // CRITICAL: Clear the bottom line of the viewport BEFORE rendering
        // Region line 1 might have scrolled to the bottom, so clear it there
        const bottomRow = terminalHeight;
        this.logToFile(`[renderNow] CRITICAL: Clearing bottom line of viewport (row ${bottomRow}) BEFORE rendering to remove leftover region line 1`);
        const savedRow = currentTerminalRow;
        this.renderBuffer.write(ansi.moveCursorTo(1, bottomRow));
        this.clearCurrentLine();
        // Move back
        if (savedRow !== null) {
          this.renderBuffer.write(ansi.moveCursorTo(1, savedRow));
          currentTerminalRow = savedRow;
        }
        this.renderBuffer.flush();
      }
      for (let i = loopStart; i < linesToRender; i++) {
        const lineIndex = startLineIndex + i;
        const content = this.pendingFrame[lineIndex] || '';
        const isLastLine = (i === linesToRender - 1);
        this.logToFile(`[renderNow] LOOP iteration i=${i}, lineIndex=${lineIndex} (region line ${lineIndex + 1}), currentTerminalRow=${currentTerminalRow}`);
        // CRITICAL: Check if this line is one of the new lines: lineIndex >= (this.height - newLinesCount)
        // Only write newline if region is expanding (shouldWriteNewlines is true)
        const isNewLine = shouldWriteNewlines && lineIndex >= (this.height - newLinesCount);
        
        // CRITICAL: Always clear the line BEFORE writing
        // This prevents any leftover content from causing duplicates
        this.clearCurrentLine();
        
        // CRITICAL: For region-exceeds-viewport with new line at bottom, write newline FIRST to trigger scroll
        // For region-fits, write content first, then newline (normal order)
        const isNewLineAtBottom = isNewLine && isLastLine;
        if (isNewLineAtBottom && regionExceedsViewport) {
          // Region exceeds viewport: write newline FIRST to trigger scroll, then query cursor
          // CRITICAL: Only query cursor if we're actually at the bottom of the viewport (will trigger scrolling)
          const isAtBottomOfViewport = currentTerminalRow !== null && currentTerminalRow === terminalHeight;
          
          this.logToFile(`[renderNow] WRITING newline FIRST for new line ${lineIndex + 1} at bottom (region expanding${isAtBottomOfViewport ? ', will trigger scroll' : ''})`);
          this.renderBuffer.write('\n');
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
              this.logToFile(`[renderNow] ✓ Cursor query after newline: row=${pos.row}, col=${pos.col} (expected row=${terminalHeight + 1} if scroll occurred)`);
              
              if (pos.row === terminalHeight + 1) {
                // Scroll happened - move up one to get back to the last visible line
                this.renderBuffer.write(ansi.moveCursorUp(1));
                this.visibleRegionTopRow = terminalHeight - (linesToRender - 1);
                this.logToFile(`[renderNow] Scroll confirmed - updated visibleRegionTopRow=${this.visibleRegionTopRow}`);
              } else {
                this.logToFile(`[renderNow] WARNING: Scroll did not occur (cursor at row=${pos.row}, expected ${terminalHeight + 1})`);
                this.visibleRegionTopRow = terminalHeight - (linesToRender - 1);
              }
            } catch (err) {
              this.logToFile(`[renderNow] ✗ Cursor query failed: ${err instanceof Error ? err.message : String(err)}, proceeding anyway`);
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
        const contentToWrite = this.truncateContent(content, this.width);
        
        // Write content (truncated only if significantly too long)
        const isFirstLine = lineIndex === 0;
        const terminalRowForLog = currentTerminalRow !== null ? `terminal row ${currentTerminalRow}` : 'terminal row unknown';
        this.logToFile(`[renderNow] WRITING content for line ${lineIndex + 1} (region line ${lineIndex + 1}/${this.height}, visible line ${i + 1}/${linesToRender}, ${terminalRowForLog}, startLineIndex=${startLineIndex}, isFirstLine=${isFirstLine}): "${contentToWrite.substring(0, 50)}${contentToWrite.length > 50 ? '...' : ''}"`);
        this.renderBuffer.write(contentToWrite);
        
        // CRITICAL: Reset ANSI codes after writing content to prevent color bleed to next line
        // This ensures that any active color/style codes are reset before moving to the next line
        this.renderBuffer.write(ansi.RESET);
        
        // CRITICAL: Write newline ONLY for new lines when region is expanding
        // After resize, we're re-rendering existing lines - NO newlines should be written
        // Only write newlines when height actually increased (shouldWriteNewlines is true)
        if (isNewLine && !isLastLine && shouldWriteNewlines) {
          // New line, not at bottom: write newline normally
          this.logToFile(`[renderNow] WRITING newline for line ${lineIndex + 1} (new line, region expanding, not at bottom)`);
          this.renderBuffer.write('\n');
          if (currentTerminalRow !== null) {
            currentTerminalRow = currentTerminalRow + 1;
          }
        } else if (isNewLineAtBottom && !regionExceedsViewport && shouldWriteNewlines) {
          // New line at bottom, region fits: write newline after content (normal order)
          this.logToFile(`[renderNow] WRITING newline for last line ${lineIndex + 1} (new line, region expanding, region fits)`);
          this.renderBuffer.write('\n');
          if (currentTerminalRow !== null) {
            currentTerminalRow = currentTerminalRow + 1;
          }
          wroteNewlineForLastLine = true;
        } else if (!isLastLine && !isNewLine) {
          // Not the last line and not a new line: move to next line (NO newline)
          this.renderBuffer.write(ansi.moveCursorDown(1));
          this.renderBuffer.write(ansi.MOVE_TO_START_OF_LINE);
          if (currentTerminalRow !== null) {
            currentTerminalRow = currentTerminalRow + 1;
          }
        }
        // After rendering last line, we're at the end of the last line
        // We'll move to top-left after the loop
      }
      
      // CRITICAL: Flush buffer after writing all content to ensure it's visible
      // This is especially important for the first render
      this.renderBuffer.flush();
      
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
      // CRITICAL: Use absolute positioning to get to top-left after rendering
      // We know where the top-left should be, so position there directly instead of using relative movements
      if (actuallyWroteNewlineAtBottom) {
        // We wrote a newline at the bottom, terminal scrolled
        // The visibleRegionTopRow moved up by 1 line due to the scroll
        if (this.visibleRegionTopRow !== null) {
          const newVisibleRegionTopRow = this.visibleRegionTopRow - 1;
          this.visibleRegionTopRow = newVisibleRegionTopRow;
          this.logToFile(`[renderNow] Wrote newline at bottom - terminal scrolled, visibleRegionTopRow moved from ${this.visibleRegionTopRow + 1} to ${newVisibleRegionTopRow}`);
          // Use absolute positioning to top-left of visible region
          this.renderBuffer.write(ansi.moveCursorTo(1, newVisibleRegionTopRow));
          this.renderBuffer.flush();
          this.stdout.write(ansi.SAVE_CURSOR);
          this.savedCursorPosition = true;
          this.logToFile(`[renderNow] Saved cursor at top-left of visible region (row ${newVisibleRegionTopRow}, absolute position)`);
        } else {
          this.logToFile(`[renderNow] WARNING: visibleRegionTopRow is null, cannot position to top-left`);
        }
      } else if (wroteNewlineForLastLine) {
        // Wrote newline for last line (region-fits case) - terminal scrolled
        // Use absolute positioning to startRow (top of region)
        if (this.startRow !== null) {
          this.logToFile(`[renderNow] Wrote newline for last line (region-fits) - positioning to startRow=${this.startRow}`);
          this.renderBuffer.write(ansi.moveCursorTo(1, this.startRow));
          this.renderBuffer.flush();
          this.stdout.write(ansi.SAVE_CURSOR);
          this.savedCursorPosition = true;
          this.visibleRegionTopRow = this.startRow;
          this.logToFile(`[renderNow] Saved cursor at top-left of region (row ${this.startRow}, absolute position)`);
        } else {
          this.logToFile(`[renderNow] WARNING: startRow is null, cannot position to top-left`);
        }
      } else {
        // No newline written, normal case - use absolute positioning
        if (regionExceedsViewport && this.visibleRegionTopRow !== null) {
          // Region exceeds viewport - position to top of visible region
          this.logToFile(`[renderNow] No newline written - positioning to visibleRegionTopRow=${this.visibleRegionTopRow} (absolute)`);
          this.renderBuffer.write(ansi.moveCursorTo(1, this.visibleRegionTopRow));
          this.renderBuffer.flush();
          this.stdout.write(ansi.SAVE_CURSOR);
          this.savedCursorPosition = true;
          this.logToFile(`[renderNow] Saved cursor at top-left of visible region (row ${this.visibleRegionTopRow}, absolute position)`);
        } else if (!regionExceedsViewport && this.startRow !== null) {
          // Region fits - position to startRow
          this.logToFile(`[renderNow] No newline written - positioning to startRow=${this.startRow} (absolute)`);
          this.renderBuffer.write(ansi.moveCursorTo(1, this.startRow));
          this.renderBuffer.flush();
          this.stdout.write(ansi.SAVE_CURSOR);
          this.savedCursorPosition = true;
          this.logToFile(`[renderNow] Saved cursor at top-left of region (row ${this.startRow}, absolute position)`);
        } else {
          this.logToFile(`[renderNow] WARNING: Cannot determine top-left position (regionExceedsViewport=${regionExceedsViewport}, visibleRegionTopRow=${this.visibleRegionTopRow}, startRow=${this.startRow})`);
        }
      }
      
      // CRITICAL: Move the VISIBLE cursor to the line AFTER the region (below it)
      // This prevents user input from overwriting the region content
      // We saved the position at top-left for our internal tracking, but the visible cursor should be out of the way
      this.stdout.write(ansi.moveCursorDown(linesToRender));
      this.stdout.write(ansi.MOVE_TO_START_OF_LINE);
      this.stdout.write(ansi.SHOW_CURSOR);
      this.logToFile(`[renderNow] Moved visible cursor DOWN ${linesToRender} lines to position AFTER region (so user input won't interfere)`);
      
      // Track visible region top row for first render
      if (!this.hasRendered) {
        if (regionExceedsViewport && this.startRow !== null) {
          this.visibleRegionTopRow = this.startRow + startLineIndex;
          this.logToFile(`[renderNow] First render - region exceeds viewport, set visibleRegionTopRow=${this.visibleRegionTopRow}`);
        } else if (!regionExceedsViewport && this.startRow !== null) {
          // For region-fits case, visibleRegionTopRow should be startRow (already set earlier, but ensure it's correct)
          if (this.visibleRegionTopRow !== this.startRow) {
            this.visibleRegionTopRow = this.startRow;
            this.logToFile(`[renderNow] First render - region fits, set visibleRegionTopRow=${this.visibleRegionTopRow}`);
          }
        }
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

  async getStartRow(): Promise<number | null> {
    // If startRow is not set yet, wait for initialization to complete
    if (this.startRow === null && this.initializationPromise) {
      await this.initializationPromise;
    }
    // CRITICAL: Flush any pending operations (like expandTo updating startRow) before returning
    // This ensures we return the current startRow after all updates are applied
    if (this.renderScheduled || this.pendingFrame.length > 0) {
      await this.flush();
    }
    return this.startRow;
  }
}

