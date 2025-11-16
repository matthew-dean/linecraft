import { createRegion, flex, col, color } from '../src/ts/index';
import { roundedBox } from '../src/ts/components/rounded-box';
import { waitForSpacebar } from '../src/ts/utils/wait-for-spacebar';

async function main() {
  const region = createRegion();

  // Helper to create a visual placeholder column (colored block)
  const visualBlock = (width: number, blockColor: string, label: string = '') => {
    const block = '█'.repeat(Math.max(1, width - label.length));
    return col({ width }, color(blockColor, block + label));
  };

  // Helper to create a labeled section with visual representation below
  const section = (title: string, content: any, visualContent?: any) => {
    const lines = [content];
    if (visualContent) {
      lines.push(visualContent);
    }
    return flex({ gap: 0 }, ...lines);
  };

  // Test 1: Basic flex with fixed widths and gap
  const basicContent = flex({ gap: 2 },
    col({ width: 10 }, color('cyan', 'Fixed 10')),
    col({ width: 20 }, color('green', 'Fixed 20')),
    col({ flex: 1 }, color('yellow', 'Flex 1'))
  );
  const basicVisual = flex({ gap: 2 },
    visualBlock(10, 'cyan', ' 10'),
    visualBlock(20, 'green', ' 20'),
    col({ flex: 1 }, color('yellow', '█'.repeat(30) + ' flex'))
  );
  region.set(section('Basic Flex', basicContent, basicVisual));
  await waitForSpacebar(region, 'Test 1: Basic flex with gap=2 - Press SPACEBAR to continue...');

  // Test 2: Flex ratios
  const ratiosContent = flex({ gap: 2 },
    col({ flex: 1 }, color('red', 'Flex 1')),
    col({ flex: 2 }, color('blue', 'Flex 2')),
    col({ flex: 1 }, color('magenta', 'Flex 1'))
  );
  const ratiosVisual = flex({ gap: 2 },
    col({ flex: 1 }, color('red', '█'.repeat(15) + ' 1x')),
    col({ flex: 2 }, color('blue', '█'.repeat(30) + ' 2x')),
    col({ flex: 1 }, color('magenta', '█'.repeat(15) + ' 1x'))
  );
  region.set(section('Flex Ratios', ratiosContent, ratiosVisual));
  await waitForSpacebar(region, 'Test 2: Flex ratios (1:2:1) - Press SPACEBAR to continue...');

  // Test 3: Min/Max constraints
  const minMaxContent = flex({ gap: 1 },
    col({ min: 10, max: 30 }, color('yellow', 'Min 10, Max 30')),
    col({ flex: 1, min: 20 }, color('cyan', 'Flex 1, Min 20')),
    col({ width: 15 }, color('green', 'Fixed 15'))
  );
  const minMaxVisual = flex({ gap: 1 },
    col({ min: 10, max: 30 }, color('yellow', '█'.repeat(15) + ' 10-30')),
    col({ flex: 1, min: 20 }, color('cyan', '█'.repeat(25) + ' 20+')),
    visualBlock(15, 'green', ' 15')
  );
  region.set(section('Min/Max Constraints', minMaxContent, minMaxVisual));
  await waitForSpacebar(region, 'Test 3: Min/Max constraints - Press SPACEBAR to continue...');

  // Test 4: Overflow handling (truncate)
  const truncateContent = flex({ gap: 1 },
    col({ width: 15, overflow: 'truncate' }, color('red', 'This is a very long text that will be truncated')),
    col({ flex: 1 }, color('blue', 'Flexible column'))
  );
  const truncateVisual = flex({ gap: 1 },
    visualBlock(15, 'red', ' 15'),
    col({ flex: 1 }, color('blue', '█'.repeat(30) + ' flex'))
  );
  region.set(section('Overflow Truncate', truncateContent, truncateVisual));
  await waitForSpacebar(region, 'Test 4: Overflow truncate - Press SPACEBAR to continue...');

  // Test 5: Overflow handling (wrap)
  const wrapContent = flex({ gap: 1 },
    col({ width: 20, overflow: 'wrap' }, color('green', 'This text will wrap to multiple lines if needed')),
    col({ flex: 1 }, color('yellow', 'Flexible column'))
  );
  const wrapVisual = flex({ gap: 1 },
    visualBlock(20, 'green', ' 20'),
    col({ flex: 1 }, color('yellow', '█'.repeat(30) + ' flex'))
  );
  region.set(section('Overflow Wrap', wrapContent, wrapVisual));
  await waitForSpacebar(region, 'Test 5: Overflow wrap - Press SPACEBAR to continue...');

  // Test 6: Nested flex
  const nestedContent = flex({ gap: 1 },
    col({ width: 10 }, color('cyan', 'Outer 1')),
    flex({ gap: 1 },
      col({ flex: 1 }, color('red', 'Inner 1')),
      col({ flex: 1 }, color('blue', 'Inner 2'))
    ),
    col({ width: 10 }, color('green', 'Outer 2'))
  );
  const nestedVisual = flex({ gap: 1 },
    visualBlock(10, 'cyan', ' outer'),
    flex({ gap: 1 },
      col({ flex: 1 }, color('red', '█'.repeat(10) + ' in1')),
      col({ flex: 1 }, color('blue', '█'.repeat(10) + ' in2'))
    ),
    visualBlock(10, 'green', ' outer')
  );
  region.set(section('Nested Flex', nestedContent, nestedVisual));
  await waitForSpacebar(region, 'Test 6: Nested flex - Press SPACEBAR to continue...');

  // Test 7: Rounded box component
  // Note: roundedBox needs to be implemented as a component
  region.set(
    flex({ gap: 1 },
      col({ width: 30, height: 5 }, color('cyan', 'Box 1 placeholder')),
      col({ width: 30, height: 5 }, color('green', 'Box 2 placeholder'))
    )
  );
  await waitForSpacebar(region, 'Test 7: Rounded boxes - Press SPACEBAR to continue...');

  // Test 8: Complex layout with boxes and text
  const complexContent = flex({ gap: 2 },
    col({ width: 25, height: 8 }, color('cyan', 'Status box')),
    flex({ gap: 1 },
      col({ flex: 1 }, color('green', 'Item 1')),
      col({ flex: 1 }, color('yellow', 'Item 2')),
      col({ flex: 1 }, color('red', 'Item 3'))
    )
  );
  const complexVisual = flex({ gap: 2 },
    visualBlock(25, 'cyan', ' box'),
    flex({ gap: 1 },
      col({ flex: 1 }, color('green', '█'.repeat(10) + ' 1')),
      col({ flex: 1 }, color('yellow', '█'.repeat(10) + ' 2')),
      col({ flex: 1 }, color('red', '█'.repeat(10) + ' 3'))
    )
  );
  region.set(section('Complex Layout', complexContent, complexVisual));
  await waitForSpacebar(region, 'Test 8: Complex layout - Press SPACEBAR to continue...');

  // Test 9: Resize behavior - show current width
  let width = region.width;
  const resizeContent = flex({ gap: 1 },
    col({ width: 20 }, color('cyan', `Width: ${width}`)),
    col({ flex: 1 }, color('yellow', 'Resize the terminal to see flex adapt!'))
  );
  const resizeVisual = flex({ gap: 1 },
    visualBlock(20, 'cyan', ` ${width}`),
    col({ flex: 1 }, color('yellow', '█'.repeat(40) + ' flex'))
  );
  region.set(section('Resize Test', resizeContent, resizeVisual));

  // Update on resize
  const resizeHandler = () => {
    width = region.width;
    const resizeContent = flex({ gap: 1 },
      col({ width: 20 }, color('cyan', `Width: ${width}`)),
      col({ flex: 1 }, color('yellow', 'Resize the terminal to see flex adapt!'))
    );
    const resizeVisual = flex({ gap: 1 },
      visualBlock(20, 'cyan', ` ${width}`),
      col({ flex: 1 }, color('yellow', '█'.repeat(40) + ' flex'))
    );
    region.set(section('Resize Test', resizeContent, resizeVisual));
  };
  process.stdout.on('resize', resizeHandler);

  await waitForSpacebar(region, 'Test 9: Resize behavior - Press SPACEBAR to exit...');
  
  process.stdout.off('resize', resizeHandler);
  region.destroy(true);
}

main().catch(console.error);
