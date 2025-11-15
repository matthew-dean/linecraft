import { createRegion, flex, col, color } from '../src/ts/index.js';
import { waitForSpacebar } from '../src/ts/utils/wait-for-spacebar.js';

async function main() {
  console.log('Flex Layout Demo - Line Management\n');
  
  const region = createRegion(); // Auto-resize enabled
  
  // Demo 1: Basic flex columns side-by-side
  console.log('Demo 1: Basic flex columns');
  region.set(
    flex({ gap: 2 },
      col({ min: 10, max: 10 }, color('cyan', 'Label:')),
      col({ flex: 1 }, color('green', 'This column grows to fill space'))
    )
  );
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Demo 2: Multiple columns with different flex ratios
  console.log('\nDemo 2: Flex ratios (1:2:1)');
  region.set(
    flex({ gap: 1 },
      col({ flex: 1 }, color('red', 'Flex 1')),
      col({ flex: 2 }, color('yellow', 'Flex 2 (double width)')),
      col({ flex: 1 }, color('blue', 'Flex 1'))
    )
  );
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Demo 3: Min/max constraints
  console.log('\nDemo 3: Min/max constraints');
  region.set(
    flex({ gap: 2 },
      col({ min: 15, max: 15 }, color('cyan', 'Fixed 15 chars')),
      col({ flex: 1, min: 20 }, color('green', 'Grows but min 20')),
      col({ flex: 1, max: 30 }, color('yellow', 'Grows but max 30'))
    )
  );
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Demo 4: Text wrapping (we manage it ourselves)
  console.log('\nDemo 4: Text wrapping');
  region.set(
    flex({ gap: 2, direction: 'column' },
      flex({ gap: 2 },
        col({ min: 12, max: 12 }, color('cyan', 'Status:')),
        col({ flex: 1 }, 'This is a long text that will wrap to multiple lines when it exceeds the available width. We manage all wrapping ourselves since auto-wrap is disabled.')
      ),
      flex({ gap: 2 },
        col({ min: 12, max: 12 }, color('cyan', 'Info:')),
        col({ flex: 1 }, 'Short text')
      )
    )
  );
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Demo 5: Resize behavior - show how flex adapts
  console.log('\nDemo 5: Resize your terminal to see flex adapt!');
  const updateResizeDemo = () => {
    const width = region.width;
    region.set(
      flex({ gap: 2 },
        col({ min: 20, max: 20 }, color('cyan', `Width: ${width}`)),
        col({ flex: 1 }, color('green', 'This column adapts to terminal width'))
      )
    );
  };
  updateResizeDemo();
  
  const resizeHandler = () => {
    setTimeout(updateResizeDemo, 50);
  };
  process.stdout.on('resize', resizeHandler);
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Demo 6: Complex nested layout
  console.log('\nDemo 6: Complex nested flex layout');
  region.set(
    flex({ gap: 1, direction: 'column' },
      flex({ gap: 2 },
        col({ min: 10, max: 10 }, color('red', 'Header 1')),
        col({ min: 10, max: 10 }, color('yellow', 'Header 2')),
        col({ flex: 1 }, color('green', 'Header 3'))
      ),
      flex({ gap: 2 },
        col({ min: 10, max: 10 }, 'Data 1'),
        col({ min: 10, max: 10 }, 'Data 2'),
        col({ flex: 1 }, 'Data 3 (grows)')
      ),
      flex({ gap: 2 },
        col({ min: 10, max: 10 }, 'More 1'),
        col({ min: 10, max: 10 }, 'More 2'),
        col({ flex: 1 }, 'More 3 (grows)')
      )
    )
  );
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  process.stdout.removeListener('resize', resizeHandler);
  
  // Final message
  region.set(
    flex({ gap: 2 },
      col({}, color('green', '✓')),
      col({ flex: 1 }, 'Demo complete! Press SPACEBAR to exit...')
    )
  );
  
  await waitForSpacebar(region);
  region.destroy(true);
  console.log('\nRegion destroyed. Demo finished!');
}

main().catch(console.error);
