// Comprehensive example demonstrating all grid features

import { region, grid, style, progressBar, fill } from '../src/index';
import { waitForSpacebar } from '../src/utils/wait-for-spacebar';

async function main() {
  const r = region();

  // Section 1: Basic grid with fixed widths
  r.set(
    grid({ template: [20, 30, '1*'] },
      style({ color: 'cyan' }, 'Fixed 20'),
      style({ color: 'green' }, 'Fixed 30'),
      style({ color: 'yellow' }, 'Flexible')
    ),
    // Visual indicator: show column widths using fill
    grid({ template: [20, 30, '1*'] },
      fill({ color: 'brightRed', char: '─' }),
      fill({ color: 'brightGreen', char: '─' }),
      fill({ color: 'brightYellow', char: '─' })
    )
  );

  await waitForSpacebar(r);

  // Section 2: Flex ratios
  r.add(
    grid({ template: ['1*', '2*', '1*'] },
      style({ color: 'red' }, 'Flex 1'),
      style({ color: 'blue' }, 'Flex 2'),
      style({ color: 'magenta' }, 'Flex 1')
    ),
    // Visual indicator: show proportional widths
    grid({ template: ['1*', '2*', '1*'] },
      fill({ color: 'brightRed', char: '█' }),
      fill({ color: 'brightBlue', char: '█' }),
      fill({ color: 'brightMagenta', char: '█' })
    )
  );

  await waitForSpacebar(r);

  // Section 3: Column gap - make it visible
  r.add(
    grid({ template: [20, 20], columnGap: 3 },
      style({ color: 'cyan' }, 'Column 1'),
      style({ color: 'green' }, 'Column 2')
    ),
    // Visual indicator: show column widths
    grid({ template: [20, 20], columnGap: 3 },
      fill({ color: 'brightCyan', char: '─' }),
      fill({ color: 'brightGreen', char: '─' })
    )
  );

  await waitForSpacebar(r);

  // Section 4: SpaceBetween - fills gaps between columns with a character
  r.add(
    grid({ template: [20, '1*', 20], columnGap: 2, spaceBetween: { char: '─', color: 'brightBlack' } },
      style({ color: 'yellow' }, 'Left'),
      style({ color: 'brightBlack' }, ''),
      style({ color: 'yellow' }, 'Right')
    ),
    // Visual indicator
    grid({ template: [20, '1*', 20], columnGap: 2 },
      fill({ color: 'brightYellow', char: '─' }),
      fill({ color: 'brightBlack', char: '─' }),
      fill({ color: 'brightYellow', char: '─' })
    )
  );

  await waitForSpacebar(r);

  // Section 5: SpaceBetween with different character
  r.add(
    grid({ template: [20, '1*', 20], columnGap: 2, spaceBetween: { char: '·', color: 'brightCyan' } },
      style({ color: 'cyan' }, 'Left'),
      style({ color: 'brightBlack' }, ''),
      style({ color: 'cyan' }, 'Right')
    ),
    // Visual indicator
    grid({ template: [20, '1*', 20], columnGap: 2 },
      fill({ color: 'brightCyan', char: '─' }),
      fill({ color: 'brightCyan', char: '─' }),
      fill({ color: 'brightCyan', char: '─' })
    )
  );

  await waitForSpacebar(r);

  // Section 6: Justify space-between - left/right items with flexing middle
  r.add(
    grid({ template: [15, '1*', 15], justify: 'space-between' },
      style({ color: 'green' }, 'Left Item'),
      style({ color: 'brightBlack' }, 'Flexing Middle'),
      style({ color: 'green' }, 'Right Item')
    ),
    // Visual indicator
    grid({ template: [15, '1*', 15], justify: 'space-between' },
      fill({ color: 'brightGreen', char: '─' }),
      fill({ color: 'brightBlack', char: '─' }),
      fill({ color: 'brightGreen', char: '─' })
    )
  );

  await waitForSpacebar(r);

  // Section 7: Overflow ellipsis
  r.add(
    grid({ template: ['1*', '1*', '1*'] },
      style({ color: 'red', overflow: 'ellipsis-end' }, 'This is a very long text that will be truncated'),
      style({ color: 'blue', overflow: 'ellipsis-start' }, 'This is a very long text that will be truncated'),
      style({ color: 'magenta', overflow: 'ellipsis-middle' }, 'This is a very long text that will be truncated')
    ),
    // Visual indicator
    grid({ template: ['1*', '1*', '1*'] },
      fill({ color: 'brightRed', char: '─' }),
      fill({ color: 'brightBlue', char: '─' }),
      fill({ color: 'brightMagenta', char: '─' })
    )
  );

  await waitForSpacebar(r);

  // Section 8: When condition (responsive)
  r.add(
    grid({ template: [20, '1*'] },
      style({ color: 'cyan' }, 'Always visible'),
      style({ 
        color: 'green', 
        when: (ctx) => ctx.availableWidth > 50 
      }, 'Only if width > 50')
    ),
    // Visual indicator
    grid({ template: [20, '1*'] },
      fill({ color: 'brightCyan', char: '─' }),
      fill({ color: 'brightGreen', char: '─' })
    )
  );

  await waitForSpacebar(r);

  // Section 9: Text alignment (left, center, right)
  r.add(
    grid({ template: ['1*', '1*', '1*'] },
      style({ color: 'cyan', align: 'left' }, 'Left'),
      style({ color: 'green', align: 'center' }, 'Center'),
      style({ color: 'yellow', align: 'right' }, 'Right')
    ),
    // Visual indicator
    grid({ template: ['1*', '1*', '1*'] },
      fill({ color: 'brightCyan', char: '─' }),
      fill({ color: 'brightGreen', char: '─' }),
      fill({ color: 'brightYellow', char: '─' })
    )
  );

  await waitForSpacebar(r);

  // Section 10: Alignment with short text
  r.add(
    grid({ template: [30, 30, 30] },
      style({ color: 'red', align: 'left' }, 'L'),
      style({ color: 'blue', align: 'center' }, 'C'),
      style({ color: 'magenta', align: 'right' }, 'R')
    ),
    // Visual indicator
    grid({ template: [30, 30, 30] },
      fill({ color: 'brightRed', char: '─' }),
      fill({ color: 'brightBlue', char: '─' }),
      fill({ color: 'brightMagenta', char: '─' })
    )
  );

  await waitForSpacebar(r);

  // Section 11: Progress bar in grid
  r.add(
    grid({ template: [20, '1*'] },
      style({ color: 'cyan' }, 'Installing...'),
      progressBar({
        current: 75,
        total: 100,
        barColor: 'green',
        bracketColor: 'brightBlack',
        percentColor: 'yellow'
      })
    ),
    // Visual indicator
    grid({ template: [20, '1*'] },
      fill({ color: 'brightCyan', char: '─' }),
      fill({ color: 'brightGreen', char: '─' })
    )
  );

  await waitForSpacebar(r);

  // Section 12: Multi-line content
  r.add(
    grid({ template: [20, '1*'] },
      style({ color: 'yellow' }, 'Single line'),
      style({ color: 'blue' }, [
        'Line 1 of multi-line',
        'Line 2 of multi-line',
        'Line 3 of multi-line',
        'This is a very long line and should auto-wrap to the next line and stuff.'
      ])
    ),
    // Visual indicator (only for first line since multi-line)
    grid({ template: [20, '1*'] },
      fill({ color: 'brightYellow', char: '─' }),
      fill({ color: 'brightBlue', char: '─' })
    )
  );

  await waitForSpacebar(r);

  // Section 13: Minmax
  r.add(
    grid({ template: [{ min: 20, width: '2*' }, '1*'] },
      style({ color: 'red' }, 'Minmax (min 20, flex 2)'),
      style({ color: 'blue' }, 'Flex 1')
    ),
    // Visual indicator
    grid({ template: [{ min: 20, width: '2*' }, '1*'] },
      fill({ color: 'brightRed', char: '─' }),
      fill({ color: 'brightBlue', char: '─' })
    )
  );

  await waitForSpacebar(r);
  r.destroy(true);
}

main().catch(console.error);
