// Utility to query terminal cursor position using ANSI DSR (Device Status Report)
// This allows us to get the actual cursor position after resize/scroll events

import { QUERY_CURSOR_POSITION } from '../native/ansi.js';

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
        
        // CRITICAL: Remove listeners FIRST before changing stdin state
        // This ensures no data handlers interfere with future input
        try {
          process.stdin.removeListener('data', onData);
        } catch {
          // Ignore if listener wasn't added
        }
        try {
          process.removeListener('SIGINT', onSIGINT);
        } catch {
          // Ignore if listener wasn't added
        }
        
        try {
          // CRITICAL: Check if stdin is already in raw mode (might be from waitForSpacebar)
          // If it is, don't change it - let waitForSpacebar manage it
          const currentRaw = process.stdin.isRaw || false;
          if (currentRaw && !wasRaw) {
            // Stdin is in raw mode but wasn't before - probably waitForSpacebar set it
            // Don't interfere - just leave it alone
          } else {
            // Restore to previous state
            process.stdin.setRawMode(wasRaw);
          }
          
          // CRITICAL: Always resume stdin after query to ensure it's ready for input
          // Even if it was paused before, we need it active for waitForSpacebar
          process.stdin.resume();
        } catch {
          // Ignore errors when restoring raw mode
        }
        
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };

    const onData = (data: string) => {
      // Only process data if we haven't resolved yet
      if (resolved) {
        return;
      }
      
      // Handle Ctrl+C explicitly - in raw mode, Ctrl+C is \u0003
      if (data === '\u0003') {
        cleanup();
        process.exit(130); // Standard exit code for SIGINT
        return;
      }
      
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

    const onSIGINT = () => {
      // Only exit if we're still waiting for the cursor position
      // If cleanup was already called, this shouldn't fire, but be defensive
      // CRITICAL: Check resolved flag BEFORE doing anything
      if (resolved) {
        // Already resolved - don't do anything, just return
        // This handler should have been removed, but if it fires, ignore it
        return;
      }
      cleanup();
      // Only exit if we're actually in the middle of a query
      // If resolved is true, cleanup() will set it, so this check is redundant but safe
      if (!resolved) {
        process.exit(130); // Standard exit code for SIGINT
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
      
      // Handle SIGINT explicitly (Ctrl+C)
      process.on('SIGINT', onSIGINT);

      // Send the query
      process.stdout.write(QUERY_CURSOR_POSITION);
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

