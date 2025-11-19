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
 * Debug example: Add three lines at a time
 * Each line shows: lineNumber: expectedRow
 * 
 * Expected behavior (assuming terminal height 20):
 * - First render: 3 lines at rows 18-20 (terminalHeight - height + 1 = 20 - 3 + 1 = 18)
 * - Second render: 6 lines at rows 15-20 (20 - 6 + 1 = 15)
 * - Third render: 9 lines at rows 12-20 (20 - 9 + 1 = 12)
 */
async function main() {
  const r = Region();
  
  // Add 3 lines
  r.add(['1', '2', '3']);
  const startRow = await r.getStartRow();
  if (startRow === null) {
    throw new Error('Start row is null');
  }
  r.setLine(1, `1: ${startRow} (terminal height is ${process.stdout.rows})`);
  for (let i = 2; i <= 3; i++) {
    r.setLine(i, `${i}: ${startRow + i - 1}`);
  }
  
  await waitForSpacebarNoPrompt();
  
  // Add 3 more lines (4, 5, 6)
  r.add(['4', '5', '6']);
  const startRow2 = await r.getStartRow();
  if (startRow2 === null) {
    throw new Error('Start row is null');
  }
  for (let i = 1; i <= 6; i++) {
    r.setLine(i, `${i}: ${startRow2 + i - 1}`);
  }
  await waitForSpacebarNoPrompt();
  
  // Add 3 more lines (7, 8, 9)
  r.add(['7', '8', '9']);
  const startRow3 = await r.getStartRow();
  if (startRow3 === null) {
    throw new Error('Start row is null');
  }
  for (let i = 1; i <= 9; i++) {
    r.setLine(i, `${i}: ${startRow3 + i - 1}`);
  }
  await waitForSpacebarNoPrompt();
  
  // Add 3 more lines (10, 11, 12)
  r.add(['10', '11', '12']);
  const startRow4 = await r.getStartRow();
  if (startRow4 === null) {
    throw new Error('Start row is null');
  }
  for (let i = 1; i <= 12; i++) {
    r.setLine(i, `${i}: ${startRow4 + i - 1}`);
  }
  await waitForSpacebarNoPrompt();
  
  r.flush();
}

main().catch(console.error);

