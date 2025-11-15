#!/usr/bin/env node
/**
 * Demo: Reactive Terminal Resize with Flex Layout
 * 
 * This demo shows how flex layouts automatically adapt to terminal resize events.
 * Try resizing your terminal window while this demo is running!
 */

import { createRegion, flex, col, color } from '../src/ts/index.js';
import { waitForSpacebar } from '../src/ts/utils/wait-for-spacebar.js';

async function main() {
  console.log('Reactive Flex Resize Demo');
  console.log('==========================');
  console.log('Resize your terminal window and watch the flex layout adapt!');
  console.log('Press SPACEBAR to exit.\n');

  // Create a region without specifying width (auto-resize enabled by default)
  const region = createRegion({
    height: 5,
  });

  // Update function that shows current width and flex behavior
  const updateDisplay = () => {
    const width = region.width;
    region.set(
      flex({ gap: 1, direction: 'column' },
        flex({ gap: 2 },
          col({ min: 15, max: 15 }, color('cyan', 'Terminal:')),
          col({ flex: 1 }, color('green', `${width} columns`))
        ),
        flex({ gap: 2 },
          col({ min: 15, max: 15 }, color('cyan', 'Fixed col:')),
          col({ flex: 1 }, color('yellow', 'This column grows/shrinks with terminal'))
        ),
        flex({ gap: 2 },
          col({ min: 15, max: 15 }, color('cyan', 'Flex ratio:')),
          col({ flex: 1 }, color('green', 'Flex 1')),
          col({ flex: 2 }, color('yellow', 'Flex 2 (double)')),
          col({ flex: 1 }, color('green', 'Flex 1'))
        ),
        flex({ gap: 2 },
          col({ min: 15, max: 15 }, color('cyan', 'Status:')),
          col({ flex: 1 }, color('green', 'Resize to see flex adapt!'))
        )
      )
    );
  };

  // Initial display
  updateDisplay();

  // Update on resize
  const resizeHandler = () => {
    setTimeout(updateDisplay, 50);
  };
  process.stdout.on('resize', resizeHandler);

  // Also update periodically to show current width
  const interval = setInterval(updateDisplay, 500);

  await waitForSpacebar(region);
  
  clearInterval(interval);
  process.stdout.removeListener('resize', resizeHandler);
  region.destroy(true);
  console.log('\n\nDemo ended. Goodbye!');
}

main().catch(console.error);
