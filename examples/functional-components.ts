import { createRegion, flex, col, color } from '../src/ts/index';
import { waitForSpacebar } from '../src/ts/utils/wait-for-spacebar';

/**
 * Example showing functional components with flex layout
 * Demonstrates:
 * - Flex columns with different flex ratios
 * - Min/max constraints
 * - Text wrapping (we manage it ourselves)
 * - Functional components returning arrays
 */

// Simple functional component - just returns a string
function label(text: string) {
  return text;
}

// Functional component that returns an array
function statusBar(status: string, ...children: any[]) {
  return [
    'Status: ',
    color('green', status),
    ' | ',
    ...children
  ];
}

// Functional component with props
function card(title: string, content: string) {
  return [
    color('bold', title),
    '\n',
    content
  ];
}

async function main() {
  const region = createRegion(); // Auto-resize enabled

  // Example 1: Basic flex with strings
  console.log('Example 1: Basic flex with strings');
  region.set(
    flex({ gap: 2 },
      'Hello',
      'World',
      col({ flex: 1 }, color('cyan', 'Grows'))
    )
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Example 2: Flex ratios
  console.log('\nExample 2: Flex ratios (1:2:1)');
  region.set(
    flex({ gap: 1 },
      col({ flex: 1 }, color('red', 'Flex 1')),
      col({ flex: 2 }, color('yellow', 'Flex 2 (double)')),
      col({ flex: 1 }, color('blue', 'Flex 1'))
    )
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Example 3: Functional component with flex
  console.log('\nExample 3: Functional components in flex');
  region.set(
    flex({ gap: 2 },
      label('Label:'),
      col({ flex: 1 }, color('cyan', 'This column grows')),
      ...statusBar('Active', 'Tasks: 5')
    )
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Example 4: Text wrapping in flex columns
  console.log('\nExample 4: Text wrapping (we manage it)');
  region.set(
    flex({ gap: 2, direction: 'column' },
      flex({ gap: 2 },
        col({ min: 12, max: 12 }, color('cyan', 'Description:')),
        col({ flex: 1 }, 'This is a long description that will wrap to multiple lines when the terminal is narrow. We manage all wrapping ourselves since auto-wrap is disabled globally.')
      ),
      flex({ gap: 2 },
        col({ min: 12, max: 12 }, color('cyan', 'Short:')),
        col({ flex: 1 }, 'Short text')
      )
    )
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Example 5: Min/max constraints
  console.log('\nExample 5: Min/max constraints');
  region.set(
    flex({ gap: 2 },
      col({ min: 15, max: 15 }, color('cyan', 'Fixed 15')),
      col({ flex: 1, min: 20 }, color('green', 'Grows, min 20')),
      col({ flex: 1, max: 30 }, color('yellow', 'Grows, max 30'))
    )
  );

  await waitForSpacebar(region);
  region.destroy(true);
}

main().catch(console.error);
