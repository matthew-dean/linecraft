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
  
  // CRITICAL: Leave the last column empty (never write a character to it)
  // This ensures content never reaches the terminal edge, preventing:
  // - Auto-wrap from triggering (even if it somehow gets enabled)
  // - Cursor positioning issues at the last column
  // - Resize-triggered reflow problems
  // 
  // How it works:
  // - We can write up to (width - 1) characters per line
  // - The cursor can be positioned at column (width - 1) after writing
  // - We never write a character to column width (the last column stays empty)
  // - This is how OhMyZsh works - it never writes to the full width
  // 
  // Example: If terminal is 80 columns, we use 79 columns max.
  // After writing 79 characters, cursor is at column 79, column 80 stays empty.
  return Math.max(1, width - 1);
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

/**
 * Listen for terminal resize events and call the callback with new dimensions
 * Returns a cleanup function to remove the listener
 */
export function onResize(callback: (width: number, height: number) => void): () => void {
  if (!process.stdout.isTTY) {
    // Not a TTY, return no-op cleanup
    return () => {};
  }

  const resizeHandler = () => {
    // Read directly from stdout to ensure we get the latest values
    // process.stdout.columns/rows are updated by Node.js when resize happens
    // CRITICAL: Apply the same margin as getTerminalWidth() - leave last column empty
    const rawWidth = process.stdout.isTTY && process.stdout.columns 
      ? process.stdout.columns 
      : getTerminalWidth();
    const width = Math.max(1, rawWidth - 1);
    const height = process.stdout.isTTY && process.stdout.rows 
      ? process.stdout.rows 
      : getTerminalHeight();
    callback(width, height);
  };

  // Listen to the 'resize' event on stdout (Node.js emits this on SIGWINCH)
  process.stdout.on('resize', resizeHandler);

  // Return cleanup function
  return () => {
    process.stdout.off('resize', resizeHandler);
  };
}

