// Comprehensive example demonstrating all grid features

import { Region, Grid, Styled, progressBar, fill, Section, prompt } from '../src/index';

async function main() {
  const r = Region();

  // Section 1: Basic grid with fixed widths
  r.set(
    Section({ title: 'Fixed & Flexible Columns' },
      Grid({ template: [20, 30, '1*'] },
        Styled({ color: 'accent' }, 'Fixed 20'),
        Styled({ color: 'success' }, 'Fixed 30'),
        Styled({ color: 'warning' }, 'Flexible')
      ),
      // Visual indicator: show column widths using fill
      Grid({ template: [20, 30, '1*'] },
        fill({ char: '─', color: 'error' }),
        fill({ char: '─', color: 'success' }),
        fill({ char: '─', color: 'warning' })
      )
    )
  );

  await prompt(r);

  // Section 2: Flex ratios
  r.add(
    Section({ title: 'Flex Ratios' },
      Grid({ template: ['1*', '2*', '1*'] },
        Styled({ color: 'error' }, 'Flex 1'),
        Styled({ color: 'info' }, 'Flex 2'),
        Styled({ color: 'location' }, 'Flex 1')
      ),
      // Visual indicator: show proportional widths
      Grid({ template: ['1*', '2*', '1*'] },
        fill({ char: '█', color: 'error' }),
        fill({ char: '█', color: 'info' }),
        fill({ char: '█', color: 'location' })
      )
    )
  );

  await prompt(r);

  // Section 3: Column gap - make it visible
  r.add(
    Section({ title: 'Column Gap' },
      Grid({ template: [20, 20], columnGap: 3 },
        Styled({ color: 'accent' }, 'Column 1'),
        Styled({ color: 'success' }, 'Column 2')
      ),
      // Visual indicator: show column widths
      Grid({ template: [20, 20], columnGap: 3 },
        fill({ char: '─', color: 'accent' }),
        fill({ char: '─', color: 'success' })
      )
    )
  );

  await prompt(r);

  // Section 4: SpaceBetween - fills gaps between columns with a character
  r.add(
    Section({ title: 'Space Between (Auto Columns)' },
      Grid({ template: ['auto', 'auto'], columnGap: 2, spaceBetween: { char: '─', color: 'muted' } },
        Styled({ color: 'warning' }, 'Left'),
        Styled({ color: 'warning', align: 'right' }, 'Right'),
        
        // Second row - Visual indicator
        fill({ char: '─', color: 'warning' }),
        fill({ char: '─', color: 'warning' })
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
        spaceBetween: { char: '·', color: 'accent' } 
      },
        Styled({ color: 'accent' }, 'Left'),
        Styled({ color: 'accent' }, 'Right'),
        fill({ char: '─', color: 'accent' }),
        fill({ char: '─', color: 'accent' }),
      ),
    )
  );

  await prompt(r);

  // Section 6: Justify space-between - left/right items with flexing middle
  r.add(
    Section({ title: 'Justify: Space Between' },
      Grid({ template: [15, '1*', 15], justify: 'space-between' },
        Styled({ color: 'success' }, 'Left Item'),
        Styled({ color: 'muted' }, 'Flexing Middle'),
        Styled({ color: 'success' }, 'Right Item')
      ),
      // Visual indicator
      Grid({ template: [15, '1*', 15], justify: 'space-between' },
        fill({ char: '─', color: 'success' }),
        fill({ char: '─', color: 'muted' }),
        fill({ char: '─', color: 'success' })
      )
    )
  );

  await prompt(r);

  // Section 7: Overflow ellipsis
  r.add(
    Section({ title: 'Text Overflow: Ellipsis' },
      Grid({ template: ['1*', '1*', '1*'] },
        Styled({ color: 'error', overflow: 'ellipsis-end' }, 'This is a very long text that will be truncated'),
        Styled({ color: 'info', overflow: 'ellipsis-start' }, 'This is a very long text that will be truncated'),
        Styled({ color: 'location', overflow: 'ellipsis-middle' }, 'This is a very long text that will be truncated')
      ),
      // Visual indicator
      Grid({ template: ['1*', '1*', '1*'] },
        fill({ char: '─', color: 'error' }),
        fill({ char: '─', color: 'info' }),
        fill({ char: '─', color: 'location' })
      )
    )
  );

  await prompt(r);

  // Section 8: When condition (responsive)
  r.add(
    Section({ title: 'Conditional Rendering' },
      Grid({ template: [20, '1*'] },
        Styled({ color: 'accent' }, 'Always visible'),
        Styled({ 
          color: 'success', 
          when: (ctx) => ctx.availableWidth > 50 
        }, 'Only if width > 50')
      ),
      // Visual indicator
      Grid({ template: [20, '1*'] },
        fill({ char: '─', color: 'accent' }),
        fill({ char: '─', color: 'success' })
      )
    )
  );

  await prompt(r);

  // Section 9: Text alignment (left, center, right)
  r.add(
    Section({ title: 'Text Alignment' },
      Grid({ template: ['1*', '1*', '1*'] },
        Styled({ color: 'accent', align: 'left' }, 'Left'),
        Styled({ color: 'success', align: 'center' }, 'Center'),
        Styled({ color: 'warning', align: 'right' }, 'Right')
      ),
      // Visual indicator
      Grid({ template: ['1*', '1*', '1*'] },
        fill({ char: '─', color: 'accent' }),
        fill({ char: '─', color: 'success' }),
        fill({ char: '─', color: 'warning' })
      )
    )
  );

  await prompt(r);

  // Section 10: Alignment with short text
  r.add(
    Section({ title: 'Alignment (Short Text)' },
      Grid({ template: [30, 30, 30] },
        Styled({ color: 'error', align: 'left' }, 'L'),
        Styled({ color: 'info', align: 'center' }, 'C'),
        Styled({ color: 'location', align: 'right' }, 'R')
      ),
      // Visual indicator
      Grid({ template: [30, 30, 30] },
        fill({ char: '─', color: 'error' }),
        fill({ char: '─', color: 'info' }),
        fill({ char: '─', color: 'location' })
      )
    )
  );

  await prompt(r);

  // Section 11: Progress bar in grid
  r.add(
    Section({ title: 'Progress Bar' },
      Grid({ template: [20, '1*'] },
        Styled({ color: 'accent' }, 'Installing...'),
        progressBar({
          current: 75,
          total: 100,
          barColor: 'success',
          bracketColor: 'muted',
          percentColor: 'warning'
        })
      ),
      // Visual indicator
      Grid({ template: [20, '1*'] },
        fill({ char: '─', color: 'accent' }),
        fill({ char: '─', color: 'success' })
      )
    )
  );

  await prompt(r);

  // Section 12: Multi-line content
  r.add(
    Section({ title: 'Multi-line Content' },
      Grid({ template: [20, '1*'] },
        Styled({ color: 'warning' }, 'Single line'),
        Styled({ color: 'info' }, [
          'Line 1 of multi-line',
          'Line 2 of multi-line',
          'Line 3 of multi-line',
          'This is a very long line and should auto-wrap to the next line and stuff.'
        ])
      ),
      // Visual indicator (only for first line since multi-line)
      Grid({ template: [20, '1*'] },
        fill({ char: '─', color: 'warning' }),
        fill({ char: '─', color: 'info' })
      )
    )
  );

  await prompt(r);

  // Section 13: Minmax
  r.add(
    Section({ title: 'Minmax Columns' },
      Grid({ template: [{ min: 20, width: '2*' }, '1*'] },
        Styled({ color: 'error' }, 'Minmax (min 20, flex 2)'),
        Styled({ color: 'accent' }, 'Flex 1')
      ),
      // Visual indicator
      Grid({ template: [{ min: 20, width: '2*' }, '1*'] },
        fill({ char: '─', color: 'error' }),
        fill({ char: '─', color: 'accent' })
      )
    )
  );

  await prompt(r);
  r.destroy();
}

main().catch(console.error);
