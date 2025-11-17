import { createRegion } from '../src';

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
 * Debug example: Add one line at a time
 * Each line shows: lineNumber: expectedRow
 * 
 * Expected behavior (assuming terminal height 20):
 * - First render: 1 line at row 20 (terminalHeight - height + 1 = 20 - 1 + 1 = 20)
 * - Second render: 2 lines at rows 19-20 (20 - 2 + 1 = 19)
 * - Third render: 3 lines at rows 18-20 (20 - 3 + 1 = 18)
 */
async function main() {
  const r = createRegion();
  const sections: any[] = [];
  
  // Add 1 line
  const section1 = r.add(['1']);
  sections.push(section1);
  const startRow1 = await r.getStartRow();
  if (startRow1 === null) {
    throw new Error('Start row is null');
  }
  section1.update([`1: ${startRow1}`]);
  await waitForSpacebarNoPrompt();
  
  // Add 2nd line
  const section2 = r.add(['2']);
  sections.push(section2);
  const startRow2 = await r.getStartRow();
  if (startRow2 === null) {
    throw new Error('Start row is null');
  }
  // Update all previous sections with their row numbers
  for (let i = 0; i < sections.length; i++) {
    sections[i].update([`${i + 1}: ${startRow2 + i}`]);
  }
  await waitForSpacebarNoPrompt();
  
  // Add 3rd line
  const section3 = r.add(['3']);
  sections.push(section3);
  const startRow3 = await r.getStartRow();
  if (startRow3 === null) {
    throw new Error('Start row is null');
  }
  // Update all previous sections with their row numbers
  for (let i = 0; i < sections.length; i++) {
    sections[i].update([`${i + 1}: ${startRow3 + i}`]);
  }
  await waitForSpacebarNoPrompt();
  
  // Add 4th line
  const section4 = r.add(['4']);
  sections.push(section4);
  const startRow4 = await r.getStartRow();
  if (startRow4 === null) {
    throw new Error('Start row is null');
  }
  // Update all previous sections with their row numbers
  for (let i = 0; i < sections.length; i++) {
    sections[i].update([`${i + 1}: ${startRow4 + i}`]);
  }
  await waitForSpacebarNoPrompt();
  
  // Add 5th line
  const section5 = r.add(['5']);
  sections.push(section5);
  const startRow5 = await r.getStartRow();
  if (startRow5 === null) {
    throw new Error('Start row is null');
  }
  // Update all previous sections with their row numbers
  for (let i = 0; i < sections.length; i++) {
    sections[i].update([`${i + 1}: ${startRow5 + i}`]);
  }
  await waitForSpacebarNoPrompt();
}

main().catch(console.error);

