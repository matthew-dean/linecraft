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

