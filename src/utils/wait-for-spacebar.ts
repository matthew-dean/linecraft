import type { TerminalRegion } from '../region.js';

/**
 * Wait for spacebar press before continuing
 * Useful for testing examples interactively
 * 
 * Adds the prompt as part of the region by expanding it, ensuring everything
 * is managed by the region and avoiding scrolling/positioning issues.
 */
export async function waitForSpacebar(
  region: TerminalRegion,
  message: string = 'Press SPACEBAR to continue...'
): Promise<void> {
  region.add(['', message]);
  region.flush();
  const promptLineNumber = region.height;
  const promptColumn = message.length + 1;
  region.showCursorAt(promptLineNumber, promptColumn);

  return new Promise((resolve) => {
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
      } catch {
        // Ignore errors when restoring raw mode
      }
      process.stdin.pause();
      process.stdin.removeListener('data', onKeyPress);
      // CRITICAL: Remove SIGINT listener to prevent memory leak
      // Each call to waitForSpacebar adds a SIGINT listener, so we must remove it
      process.removeListener('SIGINT', onSIGINT);
      region.hideCursor();
    };
    
    // Handle Ctrl+C explicitly
    process.on('SIGINT', onSIGINT);
    
    process.stdin.on('data', onKeyPress);
  });
}

