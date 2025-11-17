import type { TerminalRegion } from '../region';

/**
 * Wait for spacebar press before continuing
 * Useful for testing examples interactively
 * 
 * Adds the prompt as part of the region by expanding it, ensuring everything
 * is managed by the region and avoiding scrolling/positioning issues.
 */
export function waitForSpacebar(
  region: TerminalRegion,
  message: string = 'Press SPACEBAR to exit...'
): Promise<void> {
  return new Promise((resolve) => {
    // CRITICAL: Use add() to properly append the prompt to the region
    // This ensures the cursor is positioned at the end of the region correctly
    // and all rendering/positioning is handled properly
    region.add(['', message]);
    
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
    
    const onKeyPress = (key: string) => {
      // Spacebar or 'q' to exit
      if (key === ' ' || key === 'q') {
        cleanup();
        resolve();
      } else if (key === '\u0003') { // \u0003 is Ctrl+C
        // Ctrl+C should exit immediately and restore terminal state
        cleanup();
        process.exit(130); // Standard exit code for SIGINT
      }
    };
    
    const onSIGINT = () => {
      cleanup();
      resolve();
    };
    
    const cleanup = () => {
      try {
        process.stdin.setRawMode(false);
      } catch (err) {
        // Ignore errors when restoring raw mode
      }
      process.stdin.pause();
      process.stdin.removeListener('data', onKeyPress);
      // CRITICAL: Remove SIGINT listener to prevent memory leak
      // Each call to waitForSpacebar adds a SIGINT listener, so we must remove it
      process.removeListener('SIGINT', onSIGINT);
    };
    
    // Handle Ctrl+C explicitly
    process.on('SIGINT', onSIGINT);
    
    process.stdin.on('data', onKeyPress);
  });
}

