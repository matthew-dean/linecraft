// Comprehensive example demonstrating all grid features

import { Region, Grid, Styled, progressBar, fill, Section, prompt } from '../src/index';

async function main() {
  const r = Region();

  // Section 1: Basic grid with fixed widths
  r.set(
    Section({ title: 'Fixed & Flexible Columns' },
      Grid({ template: [20, 30, '1*'] },
        Styled({ color: 'cyan' }, 'Fixed 20'),
        Styled({ color: 'green' }, 'Fixed 30'),
        Styled({ color: 'yellow' }, 'Flexible')
      ),
      // Visual indicator: show column widths using fill
      Grid({ template: [20, 30, '1*'] },
        fill({ char: '─', color: 'brightRed' }),
        fill({ char: '─', color: 'brightGreen' }),
        fill({ char: '─', color: 'brightYellow' })
      )
    )
  );

  await prompt(r);

  // Section 2: Flex ratios
  r.add(
    Section({ title: 'Flex Ratios' },
      Grid({ template: ['1*', '2*', '1*'] },
        Styled({ color: 'red' }, 'Flex 1'),
        Styled({ color: 'blue' }, 'Flex 2'),
        Styled({ color: 'magenta' }, 'Flex 1')
      ),
      // Visual indicator: show proportional widths
      Grid({ template: ['1*', '2*', '1*'] },
        fill({ char: '█', color: 'brightRed' }),
        fill({ char: '█', color: 'brightBlue' }),
        fill({ char: '█', color: 'brightMagenta' })
      )
    )
  );

  await prompt(r);

  // Section 3: Column gap - make it visible
  r.add(
    Section({ title: 'Column Gap' },
      Grid({ template: [20, 20], columnGap: 3 },
        Styled({ color: 'cyan' }, 'Column 1'),
        Styled({ color: 'green' }, 'Column 2')
      ),
      // Visual indicator: show column widths
      Grid({ template: [20, 20], columnGap: 3 },
        fill({ char: '─', color: 'brightCyan' }),
        fill({ char: '─', color: 'brightGreen' })
      )
    )
  );

  await prompt(r);

  // Section 4: SpaceBetween - fills gaps between columns with a character
  r.add(
    Section({ title: 'Space Between (Auto Columns)' },
      Grid({ template: ['auto', 'auto'], columnGap: 2, spaceBetween: { char: '─', color: 'brightBlack' } },
        Styled({ color: 'yellow' }, 'Left'),
        Styled({ color: 'yellow', align: 'right' }, 'Right'),
        
        // Second row - Visual indicator
        fill({ char: '─', color: 'brightYellow' }),
        fill({ char: '─', color: 'brightYellow' })
      )
    )
  );

  await prompt(r);

  // Section 5: Multiple rows with aligned columns
  r.add(
    Section({ title: 'Multiple Rows with Aligned Columns' },
      Grid({ 
        columns: [20, 20],  // 2 explicit columns - children wrap to new rows
        columnGap: 2,
        rowGap: 1,
        spaceBetween: { char: '·', color: 'brightCyan' } 
      },
        Styled({ color: 'cyan' }, 'Left'),
        Styled({ color: 'cyan' }, 'Right'),
        fill({ char: '─', color: 'brightCyan' }),
        fill({ char: '─', color: 'brightCyan' }),
      ),
    )
  );

  await prompt(r);

  // Section 6: Justify space-between - left/right items with flexing middle
  r.add(
    Section({ title: 'Justify: Space Between' },
      Grid({ template: [15, '1*', 15], justify: 'space-between' },
        Styled({ color: 'green' }, 'Left Item'),
        Styled({ color: 'brightBlack' }, 'Flexing Middle'),
        Styled({ color: 'green' }, 'Right Item')
      ),
      // Visual indicator
      Grid({ template: [15, '1*', 15], justify: 'space-between' },
        fill({ char: '─', color: 'brightGreen' }),
        fill({ char: '─', color: 'brightBlack' }),
        fill({ char: '─', color: 'brightGreen' })
      )
    )
  );

  await prompt(r);

  // Section 7: Overflow ellipsis
  r.add(
    Section({ title: 'Text Overflow: Ellipsis' },
      Grid({ template: ['1*', '1*', '1*'] },
        Styled({ color: 'red', overflow: 'ellipsis-end' }, 'This is a very long text that will be truncated'),
        Styled({ color: 'blue', overflow: 'ellipsis-start' }, 'This is a very long text that will be truncated'),
        Styled({ color: 'magenta', overflow: 'ellipsis-middle' }, 'This is a very long text that will be truncated')
      ),
      // Visual indicator
      Grid({ template: ['1*', '1*', '1*'] },
        fill({ char: '─', color: 'brightRed' }),
        fill({ char: '─', color: 'brightBlue' }),
        fill({ char: '─', color: 'brightMagenta' })
      )
    )
  );

  await prompt(r);

  // Section 8: When condition (responsive)
  r.add(
    Section({ title: 'Conditional Rendering' },
      Grid({ template: [20, '1*'] },
        Styled({ color: 'cyan' }, 'Always visible'),
        Styled({ 
          color: 'green', 
          when: (ctx) => ctx.availableWidth > 50 
        }, 'Only if width > 50')
      ),
      // Visual indicator
      Grid({ template: [20, '1*'] },
        fill({ char: '─', color: 'brightCyan' }),
        fill({ char: '─', color: 'brightGreen' })
      )
    )
  );

  await prompt(r);

  // Section 9: Text alignment (left, center, right)
  r.add(
    Section({ title: 'Text Alignment' },
      Grid({ template: ['1*', '1*', '1*'] },
        Styled({ color: 'cyan', align: 'left' }, 'Left'),
        Styled({ color: 'green', align: 'center' }, 'Center'),
        Styled({ color: 'yellow', align: 'right' }, 'Right')
      ),
      // Visual indicator
      Grid({ template: ['1*', '1*', '1*'] },
        fill({ char: '─', color: 'brightCyan' }),
        fill({ char: '─', color: 'brightGreen' }),
        fill({ char: '─', color: 'brightYellow' })
      )
    )
  );

  await prompt(r);

  // Section 10: Alignment with short text
  r.add(
    Section({ title: 'Alignment (Short Text)' },
      Grid({ template: [30, 30, 30] },
        Styled({ color: 'red', align: 'left' }, 'L'),
        Styled({ color: 'blue', align: 'center' }, 'C'),
        Styled({ color: 'magenta', align: 'right' }, 'R')
      ),
      // Visual indicator
      Grid({ template: [30, 30, 30] },
        fill({ char: '─', color: 'brightRed' }),
        fill({ char: '─', color: 'brightBlue' }),
        fill({ char: '─', color: 'brightMagenta' })
      )
    )
  );

  await prompt(r);

  // Section 11: Progress bar in grid
  r.add(
    Section({ title: 'Progress Bar' },
      Grid({ template: [20, '1*'] },
        Styled({ color: 'cyan' }, 'Installing...'),
        progressBar({
          current: 75,
          total: 100,
          barColor: 'green',
          bracketColor: 'brightBlack',
          percentColor: 'yellow'
        })
      ),
      // Visual indicator
      Grid({ template: [20, '1*'] },
        fill({ char: '─', color: 'brightCyan' }),
        fill({ char: '─', color: 'brightGreen' })
      )
    )
  );

  await prompt(r);

  // Section 12: Multi-line content
  r.add(
    Section({ title: 'Multi-line Content' },
      Grid({ template: [20, '1*'] },
        Styled({ color: 'yellow' }, 'Single line'),
        Styled({ color: 'blue' }, [
          'Line 1 of multi-line',
          'Line 2 of multi-line',
          'Line 3 of multi-line',
          'This is a very long line and should auto-wrap to the next line and stuff.'
        ])
      ),
      // Visual indicator (only for first line since multi-line)
      Grid({ template: [20, '1*'] },
        fill({ char: '─', color: 'brightYellow' }),
        fill({ char: '─', color: 'brightBlue' })
      )
    )
  );

  await prompt(r);

  // Section 13: Minmax
  r.add(
    Section({ title: 'Minmax Columns' },
      Grid({ template: [{ min: 20, width: '2*' }, '1*'] },
        Styled({ color: 'red' }, 'Minmax (min 20, flex 2)'),
        Styled({ color: 'blue' }, 'Flex 1')
      ),
      // Visual indicator
      Grid({ template: [{ min: 20, width: '2*' }, '1*'] },
        fill({ char: '─', color: 'brightRed' }),
        fill({ char: '─', color: 'brightBlue' })
      )
    )
  );

  await prompt(r);
  r.destroy();
}

main().catch(console.error);
