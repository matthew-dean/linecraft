#!/usr/bin/env node
/**
 * Demo: Reactive Terminal Resize
 * 
 * This demo shows how regions can automatically react to terminal resize events.
 * Try resizing your terminal window while this demo is running!
 */

import { createRegion } from '../lib/index.js';

async function main() {
  console.log('Reactive Terminal Resize Demo');
  console.log('==============================');
  console.log('Try resizing your terminal window and watch the region adapt!');
  console.log('Press Ctrl+C to exit.\n');

  // Create a region without specifying width (auto-resize enabled by default)
  const region = createRegion({
    height: 3,
  });

  // Set initial content
  region.setLine(1, 'Line 1: This region will automatically resize when you change terminal width');
  region.setLine(2, 'Line 2: Current width: ' + region.width + ' columns');
  region.setLine(3, 'Line 3: Resize your terminal to see it update!');

  // Update the width display periodically
  // Note: The resize handler will also update the display automatically
  const interval = setInterval(() => {
    // Get current width from the region (this syncs with native region)
    const currentWidth = region.width;
    const stdoutWidth = process.stdout.columns || 0;
    region.setLine(2, `Line 2: Current width: ${currentWidth} columns (stdout: ${stdoutWidth})`);
  }, 100);

  // Wait for spacebar
  const { waitForSpacebar } = await import('../src/ts/utils/wait-for-spacebar.js');
  await waitForSpacebar();
  
  clearInterval(interval);
  region.destroy(true);
  console.log('\n\nDemo ended. Goodbye!');
}

main().catch(console.error);

