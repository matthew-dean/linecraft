// Simple test to verify flex layout and line management
import { createRegion, flex, col, color } from '../src/ts/index';
import { waitForSpacebar } from '../src/ts/utils/wait-for-spacebar';

async function main() {
  console.log('Basic Flex Test\n');
  
  const region = createRegion(); // Auto-resize enabled

  console.log('Test 1: Basic flex columns');
  region.set(
    flex({ gap: 2 },
      col({ min: 10, max: 10 }, color('cyan', 'Label:')),
      col({ flex: 1 }, color('green', 'Value'))
    )
  );
  
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\nTest 2: Multiple lines');
  region.set(
    flex({ gap: 1, direction: 'column' },
      flex({ gap: 2 },
        col({ min: 10, max: 10 }, color('cyan', 'Line 1:')),
        col({ flex: 1 }, 'Content for line 1')
      ),
      flex({ gap: 2 },
        col({ min: 10, max: 10 }, color('cyan', 'Line 2:')),
        col({ flex: 1 }, 'Content for line 2')
      ),
      flex({ gap: 2 },
        col({ min: 10, max: 10 }, color('cyan', 'Line 3:')),
        col({ flex: 1 }, 'Content for line 3')
      )
    )
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\nTest 3: Text wrapping');
  region.set(
    flex({ gap: 2 },
      col({ min: 12, max: 12 }, color('cyan', 'Wrapping:')),
      col({ flex: 1 }, 'This is a very long text that should wrap to multiple lines when the terminal is narrow. We manage all wrapping ourselves since auto-wrap is disabled.')
    )
  );

  await waitForSpacebar(region);
  console.log('\nCleaning up...');
  region.destroy(true);
  console.log('Test complete!');
}

main().catch(console.error);
