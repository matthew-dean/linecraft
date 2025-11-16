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
    // CRITICAL: Add the prompt as part of the region
    // This ensures everything is managed by the region and avoids scrolling issues
    // Get current height and add blank line + message
    const currentHeight = region.height;
    
    // Add blank line
    region.setLine(currentHeight + 1, '');
    
    // Add message
    region.setLine(currentHeight + 2, message);
    
    // Flush to ensure it's rendered
    region.flush();
    
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

