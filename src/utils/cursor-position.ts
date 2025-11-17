// Utility to query terminal cursor position using ANSI DSR (Device Status Report)
// This allows us to get the actual cursor position after resize/scroll events

import { QUERY_CURSOR_POSITION } from '../native/ansi';

export interface CursorPosition {
  row: number;
  col: number;
}

/**
 * Query the terminal for the current cursor position
 * 
 * This uses ANSI DSR (Device Status Report) escape code to ask the terminal
 * for its current cursor position. The terminal responds with the position.
 * 
 * @param timeout - Maximum time to wait for response in milliseconds (default: 1000)
 * @returns Promise resolving to cursor position {row, col} (1-based)
 * @throws Error if timeout or parsing fails
 * 
 * @example
 * ```ts
 * const pos = await queryCursorPosition();
 * console.log(`Cursor at row ${pos.row}, column ${pos.col}`);
 * ```
 */
export function queryCursorPosition(timeout: number = 1000): Promise<CursorPosition> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      reject(new Error('Not a TTY - cannot query cursor position'));
      return;
    }

    const wasRaw = process.stdin.isRaw || false;
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        try {
          process.stdin.setRawMode(wasRaw);
        } catch (err) {
          // Ignore errors when restoring raw mode
        }
        process.stdin.removeListener('data', onData);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };

    const onData = (data: string) => {
      // Terminal responds with: \x1b[row;colR
      // Example: \x1b[10;5R means row 10, column 5
      const match = /\[(\d+);(\d+)R/.exec(data);
      if (match) {
        const row = parseInt(match[1], 10);
        const col = parseInt(match[2], 10);
        cleanup();
        resolve({ row, col });
      }
    };

    // Set timeout
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout waiting for cursor position response'));
    }, timeout);

    try {
      // Set stdin to raw mode to capture the response
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', onData);

      // Send the query
      process.stdout.write(QUERY_CURSOR_POSITION);
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

