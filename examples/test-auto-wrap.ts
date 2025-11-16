import { createRegion, flex, col, color } from '../src/ts/index';
import { waitForSpacebar } from '../src/ts/utils/wait-for-spacebar';

/**
 * Test to verify auto-wrap is disabled
 * 
 * When auto-wrap is disabled:
 * - Text that exceeds terminal width should be cut off (not wrap)
 * - Resizing should NOT cause terminal to reflow existing content
 * 
 * Try resizing your terminal - the content should NOT reflow automatically.
 * Only our flex layout should adapt.
 */
async function main() {
  console.log('Auto-Wrap Disable Test');
  console.log('======================');
  console.log('Resize your terminal - content should NOT reflow automatically');
  console.log('Only our flex layout should adapt to new width\n');

  const region = createRegion();

  // Create a long line that exceeds terminal width
  const longText = 'A'.repeat(200); // 200 A's - will exceed most terminal widths

  region.set(
    flex({ gap: 2 },
      col({ min: 15, max: 15 }, color('cyan', 'Long text:')),
      col({ flex: 1 }, longText)
    )
  );

  console.log('\nIf auto-wrap is disabled:');
  console.log('- The long text should be cut off at terminal width (not wrap)');
  console.log('- Resizing should NOT cause terminal to reflow');
  console.log('- Only our flex layout should adapt\n');

  // Update on resize to show current width
  const updateDisplay = () => {
    const width = region.width;
    region.set(
      flex({ gap: 2, direction: 'column' },
        flex({ gap: 2 },
          col({ min: 15, max: 15 }, color('cyan', 'Width:')),
          col({ flex: 1 }, color('green', `${width} columns`))
        ),
        flex({ gap: 2 },
          col({ min: 15, max: 15 }, color('cyan', 'Long text:')),
          col({ flex: 1 }, longText)
        ),
        flex({ gap: 2 },
          col({ min: 15, max: 15 }, color('cyan', 'Status:')),
          col({ flex: 1 }, color('yellow', 'Resize terminal - text should NOT reflow automatically'))
        )
      )
    );
  };

  const resizeHandler = () => {
    setTimeout(updateDisplay, 50);
  };
  process.stdout.on('resize', resizeHandler);

  await waitForSpacebar(region);
  
  process.stdout.removeListener('resize', resizeHandler);
  region.destroy(true);
}

main().catch(console.error);

