import { region, flex, col, color } from '../src/ts/index';
import { showPrompt } from '../src/ts/index';

async function main() {
  const r = region();

  // Helper to create a visual placeholder column (colored block)
  const visualBlock = (width: number, blockColor: string, label: string = '') => {
    return col({ width, bg: '█', color: blockColor as any }, label);
  };

  // Helper to create a labeled section with visual representation below
  let isFirstSection = true;
  const section = (title: string, content: any, visualContent?: any) => {
    const contentLine = flex({ gap: 0 },
      col({ width: 25, color: 'brightBlack' }, title + ':'),
      content
    );
    
    if (visualContent) {
      const visualLine = flex({ gap: 0 },
        col({ width: 25, color: 'brightBlack' }, ''),
        visualContent
      );
      
      // First section uses set(), subsequent sections use add() to append
      if (isFirstSection) {
        r.set(contentLine, visualLine);
        isFirstSection = false;
      } else {
        r.add(contentLine, visualLine);
      }
    } else {
      if (isFirstSection) {
        r.set(contentLine);
        isFirstSection = false;
      } else {
        r.add(contentLine);
      }
    }
  };

  // Test 1: Fixed widths with different ellipsis positions
  const ellipsisContent = flex({ gap: 1 },
    col({ width: 20, overflow: 'ellipsis-end', color: 'cyan' }, 'This is a very long text that will be truncated at the end'),
    col({ width: 20, overflow: 'ellipsis-start', color: 'green' }, 'This is a very long text that will be truncated at the start'),
    col({ width: 20, overflow: 'ellipsis-middle', color: 'yellow' }, 'This is a very long text that will be truncated in the middle')
  );
  const ellipsisVisual = flex({ gap: 1 },
    visualBlock(20, 'cyan', ' 20'),
    visualBlock(20, 'green', ' 20'),
    visualBlock(20, 'yellow', ' 20')
  );
  section('Ellipsis Types', ellipsisContent, ellipsisVisual);
  await showPrompt(r, { message: 'see fixed widths with different ellipsis', key: 'SPACEBAR' });

  // Test 2: Flex columns with different flex grow values
  const ratiosContent = flex({ gap: 1 },
    col({ flex: 1, color: 'red' }, 'Flex 1'),
    col({ flex: 2, color: 'blue' }, 'Flex 2'),
    col({ flex: 1, color: 'magenta' }, 'Flex 1')
  );
  const ratiosVisual = flex({ gap: 1 },
    col({ flex: 1, bg: '█', color: 'red' }, ' 1x'),
    col({ flex: 2, bg: '█', color: 'blue' }, ' 2x'),
    col({ flex: 1, bg: '█', color: 'magenta' }, ' 1x')
  );
  section('Flex Ratios 1:2:1', ratiosContent, ratiosVisual);
  await showPrompt(r, { message: 'see flex ratios 1:2:1', key: 'SPACEBAR' });

  // Test 3: Mixed fixed and flex with ellipsis
  const mixedContent = flex({ gap: 2 },
    col({ width: 15, overflow: 'ellipsis-end', color: 'cyan' }, 'Fixed width with ellipsis-end'),
    col({ flex: 1, overflow: 'ellipsis-end', color: 'green' }, 'Flexible column that will truncate if too long'),
    col({ width: 10, color: 'yellow' }, 'Fixed')
  );
  const mixedVisual = flex({ gap: 2 },
    visualBlock(15, 'cyan', ' 15'),
    col({ flex: 1, bg: '█', color: 'green' }, ' flex'),
    visualBlock(10, 'yellow', ' 10')
  );
  section('Mixed Fixed + Flex', mixedContent, mixedVisual);
  await showPrompt(r, { message: 'see mixed fixed and flex with ellipsis', key: 'SPACEBAR' });

  // Test 4: Complex flex ratios (1:3:2:1)
  const complexContent = flex({ gap: 1 },
    col({ flex: 1, overflow: 'ellipsis-end', color: 'red' }, 'Flex 1'),
    col({ flex: 3, overflow: 'ellipsis-end', color: 'blue' }, 'Flex 3 - This is a longer text'),
    col({ flex: 2, overflow: 'ellipsis-end', color: 'green' }, 'Flex 2'),
    col({ flex: 1, color: 'yellow' }, 'Flex 1')
  );
  const complexVisual = flex({ gap: 1 },
    col({ flex: 1, bg: '█', color: 'red' }, ' 1x'),
    col({ flex: 3, bg: '█', color: 'blue' }, ' 3x'),
    col({ flex: 2, bg: '█', color: 'green' }, ' 2x'),
    col({ flex: 1, bg: '█', color: 'yellow' }, ' 1x')
  );
  section('Complex Ratios 1:3:2:1', complexContent, complexVisual);
  await showPrompt(r, { message: 'see complex flex ratios 1:3:2:1', key: 'SPACEBAR' });

  // Test 5: Min/Max constraints with flex
  const minMaxContent = flex({ gap: 1 },
    col({ flex: 1, min: 10, max: 30, overflow: 'ellipsis-end', color: 'cyan' }, 'Flex with min 10 max 30'),
    col({ flex: 2, min: 20, overflow: 'ellipsis-end', color: 'green' }, 'Flex 2 with min 20'),
    col({ width: 15, color: 'yellow' }, 'Fixed 15')
  );
  const minMaxVisual = flex({ gap: 1 },
    col({ flex: 1, min: 10, max: 30, bg: '█', color: 'cyan' }, ' 10-30'),
    col({ flex: 2, min: 20, bg: '█', color: 'green' }, ' 20+'),
    visualBlock(15, 'yellow', ' 15')
  );
  section('Min/Max Constraints', minMaxContent, minMaxVisual);
  await showPrompt(r, { message: 'see min/max constraints with flex', key: 'SPACEBAR' });

  // Test 6: All ellipsis types in one row
  const allEllipsisContent = flex({ gap: 2 },
    col({ flex: 1, overflow: 'ellipsis-end', color: 'red' }, 'This text will show ellipsis at the end if it overflows'),
    col({ flex: 1, overflow: 'ellipsis-start', color: 'blue' }, 'This text will show ellipsis at the start if it overflows'),
    col({ flex: 1, overflow: 'ellipsis-middle', color: 'green' }, 'This text will show ellipsis in the middle if it overflows')
  );
  const allEllipsisVisual = flex({ gap: 2 },
    col({ flex: 1, bg: '█', color: 'red' }, ' end'),
    col({ flex: 1, bg: '█', color: 'blue' }, ' start'),
    col({ flex: 1, bg: '█', color: 'green' }, ' middle')
  );
  section('All Ellipsis Types', allEllipsisContent, allEllipsisVisual);
  await showPrompt(r, { message: 'see all ellipsis types side by side', key: 'SPACEBAR' });

  // Test 7: Fixed widths with no flex
  const fixedContent = flex({ gap: 1 },
    col({ width: 12, color: 'cyan' }, 'Width 12'),
    col({ width: 18, color: 'green' }, 'Width 18'),
    col({ width: 25, color: 'yellow' }, 'Width 25')
  );
  const fixedVisual = flex({ gap: 1 },
    visualBlock(12, 'cyan', ' 12'),
    visualBlock(18, 'green', ' 18'),
    visualBlock(25, 'yellow', ' 25')
  );
  section('Fixed Widths', fixedContent, fixedVisual);
  await showPrompt(r, { message: 'see fixed widths only', key: 'SPACEBAR' });

  // Test 8: Single flex column that fills space
  const singleFlexContent = flex({ gap: 1 },
    col({ width: 20, color: 'cyan' }, 'Fixed left'),
    col({ flex: 1, overflow: 'ellipsis-end', color: 'green' }, 'This flexible column will fill all remaining space and truncate if needed'),
    col({ width: 15, color: 'yellow' }, 'Fixed right')
  );
  const singleFlexVisual = flex({ gap: 1 },
    visualBlock(20, 'cyan', ' 20'),
    col({ flex: 1, bg: '█', color: 'green' }, ' flex'),
    visualBlock(15, 'yellow', ' 15')
  );
  section('Single Flex Fills', singleFlexContent, singleFlexVisual);
  await showPrompt(r, { message: 'see single flex filling space', key: 'SPACEBAR' });

  // Test 9: Different gap sizes
  for (const gapSize of [0, 1, 2, 3, 5]) {
    const gapContent = flex({ gap: gapSize },
      col({ width: 10, color: 'red' }, 'A'),
      col({ width: 10, color: 'blue' }, 'B'),
      col({ width: 10, color: 'green' }, 'C')
    );
    const gapVisual = flex({ gap: gapSize },
      visualBlock(10, 'red'),
      visualBlock(10, 'blue'),
      visualBlock(10, 'green')
    );
    section(`Gap Size ${gapSize}`, gapContent, gapVisual);
    await showPrompt(r, { message: `see gap size ${gapSize}`, key: 'SPACEBAR' });
  }

  // Test 10: Resize behavior - show how flex adapts
  let width = r.width;
  const resizeContent = flex({ gap: 1 },
    col({ width: 15, color: 'cyan' }, `Width: ${width}`),
    col({ flex: 1, overflow: 'ellipsis-end', color: 'green' }, 'This flexible column adapts to terminal width'),
    col({ flex: 2, overflow: 'ellipsis-end', color: 'yellow' }, 'This flex 2 column gets twice the space')
  );
  const resizeVisual = flex({ gap: 1 },
    visualBlock(15, 'cyan', ` ${width}`),
    col({ flex: 1, bg: '█', color: 'green' }, ' 1x'),
    col({ flex: 2, bg: '█', color: 'yellow' }, ' 2x')
  );
  section('Resize Test', resizeContent, resizeVisual);

  // Update on resize
  const resizeHandler = () => {
    width = r.width;
    const resizeContent = flex({ gap: 1 },
      col({ width: 15, color: 'cyan' }, `Width: ${width}`),
      col({ flex: 1, overflow: 'ellipsis-end', color: 'green' }, 'This flexible column adapts to terminal width'),
      col({ flex: 2, overflow: 'ellipsis-end', color: 'yellow' }, 'This flex 2 column gets twice the space')
    );
    const resizeVisual = flex({ gap: 1 },
      visualBlock(15, 'cyan', ` ${width}`),
      col({ flex: 1, bg: '█', color: 'green' }, ' 1x'),
      col({ flex: 2, bg: '█', color: 'yellow' }, ' 2x')
    );
    section('Resize Test', resizeContent, resizeVisual);
  };
  process.stdout.on('resize', resizeHandler);

  await showPrompt(r, { message: 'resize terminal to see flex adapt - Press SPACEBAR to exit', key: 'SPACEBAR' });
  
  process.stdout.off('resize', resizeHandler);
  r.destroy(true);
}

main().catch(console.error);
