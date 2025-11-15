import type { TerminalRegion } from '../region.js';

/**
 * Wait for spacebar press before continuing
 * Useful for testing examples interactively
 * 
 * Uses the region manager to write the prompt, ensuring auto-wrap stays disabled.
 * The prompt is written to a new line below the current region.
 */
export function waitForSpacebar(
  region: TerminalRegion,
  message: string = 'Press SPACEBAR to exit...'
): Promise<void> {
  return new Promise((resolve) => {
    // CRITICAL: Don't use setLine which expands the region height
    // Instead, write directly to stdout below the region
    // This prevents the region from expanding and causing rendering issues
    
    // Get the current height to know where to write
    const currentHeight = region.height;
    
    // Write directly to stdout (bypassing region management)
    // This ensures we don't interfere with the region's height or rendering
    process.stdout.write('\n'); // Blank line
    process.stdout.write(message + '\n'); // Message
    process.stdout.write('\x1b[s'); // Save cursor position (in case we need to restore)
    
    // Set stdin to raw mode to capture individual keypresses
    if (!process.stdin.isTTY) {
      // If not a TTY, just resolve immediately
      resolve();
      return;
    }
    
    // Try to set raw mode, but handle errors gracefully
    try {
      process.stdin.setRawMode(true);
    } catch (err) {
      // If setRawMode fails (e.g., stdin is closed or not available), just resolve
      resolve();
      return;
    }
    
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    const cleanup = () => {
      try {
        process.stdin.setRawMode(false);
      } catch (err) {
        // Ignore errors when restoring raw mode
      }
      process.stdin.pause();
      process.stdin.removeListener('data', onKeyPress);
    };
    
    const onKeyPress = (key: string) => {
      // Spacebar or 'q' to exit
      if (key === ' ' || key === 'q' || key === '\u0003') { // \u0003 is Ctrl+C
        cleanup();
        resolve();
      }
    };
    
    // Handle Ctrl+C explicitly
    process.once('SIGINT', () => {
      cleanup();
      resolve();
    });
    
    process.stdin.on('data', onKeyPress);
  });
}

