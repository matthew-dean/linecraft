import { Region } from '../src';

/**
 * Custom wait function that doesn't add any lines to the region
 */
function waitForSpacebarNoPrompt(): Promise<void> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve();
      return;
    }
    
    let cleanedUp = false;
    
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      
      try {
        process.stdin.setRawMode(false);
      } catch (err) {
        // Ignore
      }
      process.stdin.pause();
      process.stdin.removeListener('data', onKeyPress);
      process.removeListener('SIGINT', onSIGINT);
    };
    
    const onKeyPress = (key: string) => {
      if (key === ' ' || key === 'q') {
        cleanup();
        resolve();
      } else if (key === '\u0003') {
        cleanup();
        process.exit(130);
      }
    };
    
    const onSIGINT = () => {
      cleanup();
      resolve();
    };
    
    try {
      process.stdin.setRawMode(true);
    } catch (err) {
      resolve();
      return;
    }
    
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    // Remove any existing listeners first to prevent duplicates
    process.stdin.removeListener('data', onKeyPress);
    process.removeListener('SIGINT', onSIGINT);
    
    process.on('SIGINT', onSIGINT);
    process.stdin.on('data', onKeyPress);
  });
}

/**
 * Debug example: Add two lines at a time
 * Each line shows: lineNumber: expectedRow
 * 
 * Expected behavior (assuming terminal height 20):
 * - First render: 2 lines at rows 19-20 (terminalHeight - height + 1 = 20 - 2 + 1 = 19)
 * - Second render: 4 lines at rows 17-20 (20 - 4 + 1 = 17)
 * - Third render: 6 lines at rows 15-20 (20 - 6 + 1 = 15)
 */
async function main() {
  const r = Region();
  
  // Add 2 lines
  r.add(['1', '2']);
  const startRow1 = await r.getStartRow();
  if (startRow1 === null) {
    throw new Error('Start row is null');
  }
  for (let i = 1; i <= 2; i++) {
    r.setLine(i, `${i}: ${startRow1 + i - 1}`);
  }
  await waitForSpacebarNoPrompt();
  
  // Add 2 more lines (3 and 4)
  r.add(['3', '4']);
  const startRow2 = await r.getStartRow();
  if (startRow2 === null) {
    throw new Error('Start row is null');
  }
  for (let i = 1; i <= 4; i++) {
    r.setLine(i, `${i}: ${startRow2 + i - 1}`);
  }
  await waitForSpacebarNoPrompt();
  
  // Add 2 more lines (5 and 6)
  r.add(['5', '6']);
  const startRow3 = await r.getStartRow();
  if (startRow3 === null) {
    throw new Error('Start row is null');
  }
  for (let i = 1; i <= 6; i++) {
    r.setLine(i, `${i}: ${startRow3 + i - 1}`);
  }
  await waitForSpacebarNoPrompt();
  
  // Add 2 more lines (7 and 8)
  r.add(['7', '8']);
  const startRow4 = await r.getStartRow();
  if (startRow4 === null) {
    throw new Error('Start row is null');
  }
  for (let i = 1; i <= 8; i++) {
    r.setLine(i, `${i}: ${startRow4 + i - 1}`);
  }
  await waitForSpacebarNoPrompt();
  
  r.flush();
}

main().catch(console.error);

