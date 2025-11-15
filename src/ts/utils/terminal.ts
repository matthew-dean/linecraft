// Terminal utilities for detecting terminal size and capabilities

/**
 * Get the terminal width in columns.
 * Returns the actual width if available, or a sensible default.
 */
export function getTerminalWidth(): number {
  // process.stdout.columns is the standard way to get terminal width
  // It's undefined if stdout is not a TTY (e.g., piped output)
  if (process.stdout.isTTY && process.stdout.columns) {
    return process.stdout.columns;
  }
  
  // Fallback to environment variable (some terminals set this)
  const envCols = process.env.COLUMNS;
  if (envCols) {
    const cols = parseInt(envCols, 10);
    if (!isNaN(cols) && cols > 0) {
      return cols;
    }
  }
  
  // Default fallback
  return 80;
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
    const width = process.stdout.isTTY && process.stdout.columns 
      ? process.stdout.columns 
      : getTerminalWidth();
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

