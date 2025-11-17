// ANSI escape code generation - TypeScript implementation
// Optimized for Node.js string operations

/**
 * Move cursor to absolute position (1-based coordinates)
 * Format: \x1b[row;colH
 */
export function moveCursorTo(x: number, y: number): string {
  // Use template literals - V8 optimizes these well
  return `\x1b[${y};${x}H`;
}

/**
 * Move cursor up N lines
 * Format: \x1b[nA
 */
export function moveCursorUp(n: number): string {
  return `\x1b[${n}A`;
}

/**
 * Move cursor down N lines
 * Format: \x1b[nB
 */
export function moveCursorDown(n: number): string {
  return `\x1b[${n}B`;
}

/**
 * Move cursor right N columns
 * Format: \x1b[nC
 */
export function moveCursorRight(n: number): string {
  return `\x1b[${n}C`;
}

/**
 * Move cursor left N columns
 * Format: \x1b[nD
 */
export function moveCursorLeft(n: number): string {
  return `\x1b[${n}D`;
}

/**
 * Move cursor to start of line (move left a large number to ensure we're at column 1)
 * Format: \x1b[1000D
 * This is more reliable than \r in some terminals
 * From: https://www.lihaoyi.com/post/BuildyourownCommandLinewithANSIescapecodes.html
 */
export const MOVE_TO_START_OF_LINE = '\x1b[1000D';

// ANSI constants - pre-computed for performance
export const CLEAR_LINE = '\x1b[2K';
export const CLEAR_TO_END = '\x1b[0K';
export const CLEAR_TO_START = '\x1b[1K';
export const HIDE_CURSOR = '\x1b[?25l';
export const SHOW_CURSOR = '\x1b[?25h';
export const SAVE_CURSOR = '\x1b[s';
export const RESTORE_CURSOR = '\x1b[u';
export const RESET = '\x1b[0m';

/**
 * Delete N lines starting from the current line
 * Format: \x1b[nM (deletes n lines, shifting content up)
 */
export function deleteLines(n: number): string {
  return `\x1b[${n}M`;
}

/**
 * Erase Display (ED) - Clear from cursor to end of screen
 * Format: \x1b[J or \x1b[0J
 * This clears everything from the cursor position to the end of the screen
 */
export const ERASE_TO_END = '\x1b[J';

/**
 * Erase Display (ED) - Clear from cursor to beginning of screen
 * Format: \x1b[1J
 * This clears everything from the beginning of the screen to the cursor position
 */
export const ERASE_TO_START = '\x1b[1J';

/**
 * Erase Display (ED) - Clear entire screen
 * Format: \x1b[2J
 * This clears the entire screen and moves cursor to home position
 */
export const ERASE_SCREEN = '\x1b[2J';

/**
 * Disable terminal auto-wrap mode (DECAWM off)
 * 
 * When auto-wrap is disabled:
 * - Text that exceeds terminal width is cut off (doesn't wrap to next line)
 * - Useful for right-pinned elements like OhMyZsh prompts
 * - Content stays at fixed column position, making updates easier
 * 
 * Equivalent to: `tput rmam` (reset mode automatic margins)
 * Format: \x1b[?7l
 * 
 * IMPORTANT: Always re-enable auto-wrap after writing non-wrapping content!
 * Use ENABLE_AUTO_WRAP to restore default behavior.
 */
export const DISABLE_AUTO_WRAP = '\x1b[?7l';

/**
 * Enable terminal auto-wrap mode (DECAWM on)
 * 
 * Re-enables automatic wrapping (default terminal behavior).
 * Text that exceeds terminal width will wrap to the next line.
 * 
 * Equivalent to: `tput smam` (set mode automatic margins)
 * Format: \x1b[?7h
 * 
 * This is the default terminal state. Use this to restore after DISABLE_AUTO_WRAP.
 */
export const ENABLE_AUTO_WRAP = '\x1b[?7h';

/**
 * Query cursor position (DSR - Device Status Report)
 * Format: \x1b[6n
 * 
 * Sends a query to the terminal asking for the current cursor position.
 * Terminal responds with: \x1b[row;colR (e.g., \x1b[10;5R means row 10, column 5)
 * 
 * This can be used to query the actual cursor position after resize/scroll,
 * instead of relying on SAVE/RESTORE which may become invalid.
 * 
 * Note: Requires reading from stdin and parsing the response asynchronously.
 */
export const QUERY_CURSOR_POSITION = '\x1b[6n';

