// Comprehensive example demonstrating all grid features

import { region, grid, style, progressBar } from '../src/index';
import { waitForSpacebar } from '../src/utils/wait-for-spacebar';

async function main() {
  const r = region();

  // Section 1: Basic grid with fixed widths
  r.set(
    grid({ template: [20, 30, '1*'] },
      style({ color: 'cyan' }, 'Fixed 20'),
      style({ color: 'green' }, 'Fixed 30'),
      style({ color: 'yellow' }, 'Flexible')
    )
  );

  await waitForSpacebar(r);
  // Demonstrates separator line: fills each column with separator characters
  // Note: spaceBetween only fills gaps between columns, so for full-width separators
  // we fill each column individually with repeat()
  r.add(
    grid({ template: [20, 30, '1*'] },
      style({ color: 'brightBlack' }, '─'.repeat(20)),
      style({ color: 'brightBlack' }, '─'.repeat(30)),
      style({ color: 'brightBlack' }, '─'.repeat(30))
    )
  );

  await waitForSpacebar(r);

  // Section 2: Flex ratios
  r.add(
    grid({ template: ['1*', '2*', '1*'] },
      style({ color: 'red' }, 'Flex 1'),
      style({ color: 'blue' }, 'Flex 2'),
      style({ color: 'magenta' }, 'Flex 1')
    )
  );

  await waitForSpacebar(r);
  // Demonstrates flex ratios visually: middle column gets 2x the space of outer columns
  // The block characters fill their allocated space, showing the proportional distribution
  r.add(
    grid({ template: ['1*', '2*', '1*'] },
      style({ color: 'brightBlack' }, '█'.repeat(20)),
      style({ color: 'brightBlack' }, '█'.repeat(40)),
      style({ color: 'brightBlack' }, '█'.repeat(20))
    )
  );

  // Section 3: Column gap
  r.add(
    grid({ template: [20, 20], columnGap: 3 },
      style({ color: 'cyan' }, 'Column 1'),
      style({ color: 'green' }, 'Column 2')
    )
  );

  await waitForSpacebar(r);

  // Section 4: SpaceBetween with character
  r.add(
    grid({ template: [20, '1*', 20], columnGap: 2, spaceBetween: '─' },
      style({ color: 'yellow' }, 'Left'),
      style({ color: 'brightBlack' }, 'Middle'),
      style({ color: 'yellow' }, 'Right')
    )
  );

  await waitForSpacebar(r);

  // Section 5: SpaceBetween with color
  r.add(
    grid({ template: [20, '1*', 20], columnGap: 2, spaceBetween: { char: '·', color: 'brightBlack' } },
      style({ color: 'cyan' }, 'Left'),
      style({ color: 'brightBlack' }, 'Middle'),
      style({ color: 'cyan' }, 'Right')
    )
  );

  await waitForSpacebar(r);

  // Section 6: Justify space-between
  r.add(
    grid({ template: [15, '1*', 15], justify: 'space-between' },
      style({ color: 'green' }, 'Left Item'),
      style({ color: 'brightBlack' }, 'Flexing Middle'),
      style({ color: 'green' }, 'Right Item')
    )
  );

  await waitForSpacebar(r);

  // Section 7: Overflow ellipsis
  r.add(
    grid({ template: [15, 15, 15] },
      style({ color: 'red', overflow: 'ellipsis-end' }, 'This is a very long text that will be truncated'),
      style({ color: 'blue', overflow: 'ellipsis-start' }, 'This is a very long text that will be truncated'),
      style({ color: 'magenta', overflow: 'ellipsis-middle' }, 'This is a very long text that will be truncated')
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
    )
  );

  await waitForSpacebar(r);

  // Section 9: Progress bar in grid
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
    )
  );

  await waitForSpacebar(r);

  // Section 10: Multi-line content
  r.add(
    grid({ template: [20, '1*'] },
      style({ color: 'yellow' }, 'Single line'),
      style({ color: 'blue' }, [
        'Line 1 of multi-line',
        'Line 2 of multi-line',
        'Line 3 of multi-line'
      ])
    )
  );

  await waitForSpacebar(r);

  // Section 11: Minmax
  r.add(
    grid({ template: [{ min: 40, width: '2*' }, '1*'] },
      style({ color: 'red' }, 'Minmax (min 40, flex 2)'),
      style({ color: 'blue' }, 'Flex 1')
    )
  );

  await waitForSpacebar(r);
  r.destroy(true);
}

main().catch(console.error);

