/**
 * Wait for spacebar press before continuing
 * Useful for testing examples interactively
 */
export function waitForSpacebar(message: string = 'Press SPACEBAR to exit...'): Promise<void> {
  return new Promise((resolve) => {
    // Show message
    console.log(`\n${message}`);
    
    // Set stdin to raw mode to capture individual keypresses
    if (!process.stdin.isTTY) {
      // If not a TTY, just resolve immediately
      resolve();
      return;
    }
    
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    const onKeyPress = (key: string) => {
      // Spacebar or 'q' to exit
      if (key === ' ' || key === 'q' || key === '\u0003') { // \u0003 is Ctrl+C
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onKeyPress);
        resolve();
      }
    };
    
    process.stdin.on('data', onKeyPress);
  });
}

