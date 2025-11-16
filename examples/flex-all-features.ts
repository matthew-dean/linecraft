import { region, flex, col, color, divider, showPrompt } from '../src/ts/index';

async function main() {
  const r = region();

  // Helper to create a visual placeholder column (colored block)
  const visualBlock = (width: number, blockColor: string, label: string = '') => {
    return col({ width, bg: '█', color: blockColor }, label);
  };

  // Helper to render a labeled section with visual representation below
  // Each section has 3 lines: title, text content, visualizer
  let isFirstSection = true;
  const renderSection = (title: string, contentFlex: any, visualFlex?: any) => {
    // Line 1: Title line (just the title)
    const titleLine = flex({ gap: 0 },
      col({ width: 25, color: 'brightBlack' }, title + ':')
    );
    
    // Line 2: Content line (just the content, no title)
    const contentLine = flex({ gap: 0 },
      col({ width: 25, color: 'brightBlack' }, ''),
      contentFlex
    );
    
    // Line 3: Visual line (just the visual, no empty space)
    if (visualFlex) {
      const visualLine = flex({ gap: 0 },
        col({ width: 25, color: 'brightBlack' }, ''),
        visualFlex
      );
      
      // First section uses set(), subsequent sections use add() to append
      if (isFirstSection) {
        r.set(titleLine, contentLine, visualLine);
        isFirstSection = false;
      } else {
        r.add(titleLine, contentLine, visualLine);
      }
    } else {
      // Just render title and content lines
      if (isFirstSection) {
        r.set(titleLine, contentLine);
        isFirstSection = false;
      } else {
        r.add(titleLine, contentLine);
      }
    }
  };

  // Test 1: Fixed widths with different ellipsis positions
  const ellipsisContent = flex({ gap: 1 },
    col({ width: 20, overflow: 'ellipsis-end', color: 'cyan' }, 'Ellipsis at end of long text'),
    col({ width: 20, overflow: 'ellipsis-start', color: 'green' }, 'Ellipsis at start of long text'),
    col({ width: 20, overflow: 'ellipsis-middle', color: 'yellow' }, 'Ellipsis in middle of long text')
  );
  const ellipsisVisual = flex({ gap: 1 },
    visualBlock(20, 'cyan', ' 20'),
    visualBlock(20, 'green', ' 20'),
    visualBlock(20, 'yellow', ' 20')
  );
  renderSection('Ellipsis Types', ellipsisContent, ellipsisVisual);
  await showPrompt(r, { message: 'see ellipsis types', key: 'SPACEBAR' });

  // Test 2: Flex ratios with connecting lines
  // Visual must use EXACT same flex settings: gap: 0, same flex ratios
  const ratiosContent = flex({ gap: 0 },
    col({ flex: 1, color: 'red' }, 'Flex 1'),
    divider({ fillChar: '─', style: 'single', color: 'brightBlack' }),
    col({ flex: 2, color: 'blue' }, 'Flex 2'),
    divider({ fillChar: '─', style: 'single', color: 'brightBlack' }),
    col({ flex: 1, color: 'magenta' }, 'Flex 1')
  );
  const ratiosVisual = flex({ gap: 0 },  // Same gap!
    col({ flex: 1, bg: '█', color: 'red' }, ' 1x'),  // Same flex: 1!
    col({ width: 1, color: 'brightBlack' }, '│'),
    col({ flex: 2, bg: '█', color: 'blue' }, ' 2x'),  // Same flex: 2!
    col({ width: 1, color: 'brightBlack' }, '│'),
    col({ flex: 1, bg: '█', color: 'magenta' }, ' 1x')  // Same flex: 1!
  );
  renderSection('Flex Ratios 1:2:1', ratiosContent, ratiosVisual);
  await showPrompt(r, { message: 'see flex ratios with lines', key: 'SPACEBAR' });

  // Test 3: Complex flex ratios with different line styles
  const complexContent = flex({ gap: 0 },
    col({ flex: 1, overflow: 'ellipsis-end', color: 'red' }, 'Flex 1'),
    divider({ fillChar: '━', style: 'thick', color: 'brightBlack' }),
    col({ flex: 3, overflow: 'ellipsis-end', color: 'blue' }, 'Flex 3'),
    divider({ fillChar: '═', style: 'double', color: 'brightBlack' }),
    col({ flex: 2, overflow: 'ellipsis-end', color: 'green' }, 'Flex 2'),
    divider({ fillChar: '┄', style: 'dashed', color: 'brightBlack' }),
    col({ flex: 1, color: 'yellow' }, 'Flex 1')
  );
  const complexVisual = flex({ gap: 0 },
    col({ flex: 1, bg: '█', color: 'red' }, ' 1x'),
    col({ width: 1, color: 'brightBlack' }, '━'),
    col({ flex: 3, bg: '█', color: 'blue' }, ' 3x'),
    col({ width: 1, color: 'brightBlack' }, '═'),
    col({ flex: 2, bg: '█', color: 'green' }, ' 2x'),
    col({ width: 1, color: 'brightBlack' }, '┄'),
    col({ flex: 1, bg: '█', color: 'yellow' }, ' 1x')
  );
  renderSection('Complex Ratios 1:3:2:1', complexContent, complexVisual);
  await showPrompt(r, { message: 'see complex ratios with different line styles', key: 'SPACEBAR' });

  // Test 4: Mixed fixed and flex with connecting lines
  const mixedContent = flex({ gap: 0 },
    col({ width: 15, overflow: 'ellipsis-end', color: 'cyan' }, 'Fixed 15'),
    divider({ fillChar: '─', style: 'single', color: 'brightBlack' }),
    col({ flex: 1, overflow: 'ellipsis-end', color: 'green' }, 'Flexible'),
    divider({ fillChar: '─', style: 'single', color: 'brightBlack' }),
    col({ width: 10, color: 'yellow' }, 'Fixed 10')
  );
  const mixedVisual = flex({ gap: 0 },
    visualBlock(15, 'cyan', ' 15'),
    col({ width: 1, color: 'brightBlack' }, '│'),
    col({ flex: 1, bg: '█', color: 'green' }, ' flex'),
    col({ width: 1, color: 'brightBlack' }, '│'),
    visualBlock(10, 'yellow', ' 10')
  );
  renderSection('Mixed Fixed + Flex', mixedContent, mixedVisual);
  await showPrompt(r, { message: 'see mixed fixed and flex', key: 'SPACEBAR' });

  // Test 5: Min/Max constraints
  // Visual must match: gap: 1, same flex, min, max values
  const minMaxContent = flex({ gap: 1 },
    col({ flex: 1, min: 10, max: 30, overflow: 'ellipsis-end', color: 'cyan' }, 'Min 10 Max 30'),
    col({ flex: 2, min: 20, overflow: 'ellipsis-end', color: 'green' }, 'Flex 2 Min 20'),
    col({ width: 15, color: 'yellow' }, 'Fixed 15')
  );
  const minMaxVisual = flex({ gap: 1 },  // Same gap!
    col({ flex: 1, min: 10, max: 30, bg: '█', color: 'cyan' }, ' 10-30'),  // Same flex, min, max!
    col({ flex: 2, min: 20, bg: '█', color: 'green' }, ' 20+'),  // Same flex, min!
    visualBlock(15, 'yellow', ' 15')  // Same width!
  );
  renderSection('Min/Max Constraints', minMaxContent, minMaxVisual);
  await showPrompt(r, { message: 'see min/max constraints', key: 'SPACEBAR' });

  // Test 6: All ellipsis types with connecting lines
  // Visual must match: gap: 0, same flex: 1 for all
  const allEllipsisContent = flex({ gap: 0 },
    col({ flex: 1, overflow: 'ellipsis-end', color: 'red' }, 'Ellipsis at end of very long text'),
    divider({ fillChar: '─', style: 'single', color: 'brightBlack' }),
    col({ flex: 1, overflow: 'ellipsis-start', color: 'blue' }, 'Ellipsis at start of very long text'),
    divider({ fillChar: '─', style: 'single', color: 'brightBlack' }),
    col({ flex: 1, overflow: 'ellipsis-middle', color: 'green' }, 'Ellipsis in middle of very long text')
  );
  const allEllipsisVisual = flex({ gap: 0 },  // Same gap!
    col({ flex: 1, bg: '█', color: 'red' }, ' end'),  // Same flex: 1!
    col({ width: 1, color: 'brightBlack' }, '│'),
    col({ flex: 1, bg: '█', color: 'blue' }, ' start'),  // Same flex: 1!
    col({ width: 1, color: 'brightBlack' }, '│'),
    col({ flex: 1, bg: '█', color: 'green' }, ' middle')  // Same flex: 1!
  );
  renderSection('All Ellipsis Types', allEllipsisContent, allEllipsisVisual);
  await showPrompt(r, { message: 'see all ellipsis with lines', key: 'SPACEBAR' });

  // Test 7: Gap sizes demonstration
  for (const gapSize of [0, 1, 3]) {
    const gapContent = flex({ gap: gapSize },
      col({ width: 8, color: 'cyan' }, `Gap ${gapSize}`),
      col({ width: 8, color: 'green' }, `Gap ${gapSize}`),
      col({ width: 8, color: 'yellow' }, `Gap ${gapSize}`)
    );
    const gapVisual = flex({ gap: gapSize },
      visualBlock(8, 'cyan'),
      visualBlock(8, 'green'),
      visualBlock(8, 'yellow')
    );
    renderSection('Gap Sizes', gapContent, gapVisual);
    await showPrompt(r, { message: `see gap=${gapSize}`, key: 'SPACEBAR' });
  }

  // Test 8: Resize behavior with labels and connecting lines
  // Visual must match: gap: 0, same widths and flex values
  let width = r.width;
  const resizeContent = flex({ gap: 0 },
    col({ width: 12, color: 'cyan' }, `W: ${width}`),
    divider({ fillChar: '─', style: 'single', color: 'brightBlack' }),
    col({ flex: 1, overflow: 'ellipsis-end', color: 'green' }, 'Flexible column adapts'),
    divider({ fillChar: '─', style: 'single', color: 'brightBlack' }),
    col({ flex: 2, overflow: 'ellipsis-end', color: 'yellow' }, 'Flex 2 gets 2x space')
  );
  const resizeVisual = flex({ gap: 0 },  // Same gap!
    visualBlock(12, 'cyan', ` ${width}`),  // Same width: 12!
    col({ width: 1, color: 'brightBlack' }, '│'),
    col({ flex: 1, bg: '█', color: 'green' }, ' 1x'),  // Same flex: 1!
    col({ width: 1, color: 'brightBlack' }, '│'),
    col({ flex: 2, bg: '█', color: 'yellow' }, ' 2x')  // Same flex: 2!
  );
  renderSection('Resize Test', resizeContent, resizeVisual);

  // Update on resize
  const resizeHandler = () => {
    width = r.width;
    const resizeContent = flex({ gap: 0 },
      col({ width: 12, color: 'cyan' }, `W: ${width}`),
      divider({ fillChar: '─', style: 'single', color: 'brightBlack' }),
      col({ flex: 1, overflow: 'ellipsis-end', color: 'green' }, 'Flexible column adapts'),
      divider({ fillChar: '─', style: 'single', color: 'brightBlack' }),
      col({ flex: 2, overflow: 'ellipsis-end', color: 'yellow' }, 'Flex 2 gets 2x space')
    );
    const resizeVisual = flex({ gap: 0 },  // Same gap!
      visualBlock(12, 'cyan', ` ${width}`),  // Same width: 12!
      col({ width: 1, color: 'brightBlack' }, '│'),
      col({ flex: 1, bg: '█', color: 'green' }, ' 1x'),  // Same flex: 1!
      col({ width: 1, color: 'brightBlack' }, '│'),
      col({ flex: 2, bg: '█', color: 'yellow' }, ' 2x')  // Same flex: 2!
    );
    renderSection('Resize Test', resizeContent, resizeVisual);
  };
  process.stdout.on('resize', resizeHandler);

  await showPrompt(r, { message: 'resize terminal - Press SPACEBAR to exit', key: 'SPACEBAR' });
  
  process.stdout.off('resize', resizeHandler);
  r.destroy(true);
}

main().catch(console.error);

