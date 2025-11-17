// Terminal utilities for detecting terminal size and capabilities

/**
 * Get the terminal width in columns.
 * Returns the actual width if available, or a sensible default.
  * 
 * CRITICAL: We subtract 1 to leave a margin, preventing content from reaching
 * the terminal edge. This prevents auto-wrap issues and cursor positioning problems,
 * similar to how OhMyZsh works. Content will never exceed (terminalWidth - 1).
 */
export function getTerminalWidth(): number {
  let width: number;
  
  // process.stdout.columns is the standard way to get terminal width
  // It's undefined if stdout is not a TTY (e.g., piped output)
  if (process.stdout.isTTY && process.stdout.columns) {
    width = process.stdout.columns;
  } else {
    // Fallback to environment variable (some terminals set this)
    const envCols = process.env.COLUMNS;
    if (envCols) {
      const cols = parseInt(envCols, 10);
      if (!isNaN(cols) && cols > 0) {
        width = cols;
      } else {
        width = 80; // Default fallback
      }
    } else {
      width = 80; // Default fallback
    }
  }
  
  // CRITICAL: Reserve 2 columns to prevent cursor wrapping
  // - Writing exactly (terminal_width - 1) characters puts cursor at last column, causing wrap
  // - We need to write (terminal_width - 2) characters to keep cursor safe
  // - After writing (width - 2) characters, cursor is at column (width - 2), leaving columns (width - 1) and width empty
  // 
  // Example: If terminal is 80 columns, we can write up to 78 characters.
  // After writing 78 characters, cursor is at column 78, columns 79-80 stay empty.
  return Math.max(1, width - 2);
}

/**
 * Get the terminal height in rows.
 * Returns the actual height if available, or a sensible default.
 */
export function getTerminalHeight(): number {
  if (process.stdout.isTTY && process.stdout.rows) {
    return process.stdout.rows;
  }
  
  // Fallback to environment variable
  const envRows = process.env.LINES;
  if (envRows) {
    const rows = parseInt(envRows, 10);
    if (!isNaN(rows) && rows > 0) {
      return rows;
    }
  }
  
  // Default fallback
  return 24;
}

/**
 * Check if stdout is a TTY (interactive terminal)
 */
export function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

// Singleton pattern for resize listeners to prevent memory leak
// Multiple regions can register callbacks, but we only add one listener to process.stdout
let resizeListenersSetup = false;
const resizeCallbacks: Set<(width: number, height: number) => void> = new Set();

/**
 * Listen for terminal resize events and call the callback with new dimensions
 * Returns a cleanup function to remove the listener
 * 
 * Uses singleton pattern: only one listener on process.stdout, but tracks all callbacks
 * This prevents MaxListenersExceededWarning when multiple regions are created
 */
export function onResize(callback: (width: number, height: number) => void): () => void {
  if (!process.stdout.isTTY) {
    // Not a TTY, return no-op cleanup
    return () => {};
  }

  // Add callback to set
  resizeCallbacks.add(callback);

  // Set up singleton listener if not already set up
  if (!resizeListenersSetup) {
    resizeListenersSetup = true;

  const resizeHandler = () => {
    // Read directly from stdout to ensure we get the latest values
    // process.stdout.columns/rows are updated by Node.js when resize happens
    // CRITICAL: Apply the same margin as getTerminalWidth() - reserve 2 columns
    const rawWidth = process.stdout.isTTY && process.stdout.columns 
      ? process.stdout.columns 
      : 80;
    const width = Math.max(1, rawWidth - 2);
    const height = process.stdout.isTTY && process.stdout.rows 
      ? process.stdout.rows 
      : getTerminalHeight();
      
      // Call all registered callbacks
      for (const cb of resizeCallbacks) {
        cb(width, height);
      }
  };

  // Listen to the 'resize' event on stdout (Node.js emits this on SIGWINCH)
    // Only add ONE listener, regardless of how many callbacks are registered
  process.stdout.on('resize', resizeHandler);
  }

  // Return cleanup function
  return () => {
    resizeCallbacks.delete(callback);
    // Note: We don't remove the listener from process.stdout even when all callbacks are removed
    // because it's harmless to keep it, and removing/re-adding could cause issues
    // The listener will be cleaned up when the process exits
  };
}

