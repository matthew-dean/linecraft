// OhMyZsh-style prompt using grid with justify: 'space-between'

import { region, grid, style } from '../src/index';
import { waitForSpacebar } from '../src/utils/wait-for-spacebar';

async function main() {
  const r = region();

  const branch = 'main';
  const status = '✓';

  // OhMyZsh-style prompt: [branch] ──────────────────────────────── [status]
  // Using justify: 'space-between' to pin left and right items
  r.set(
    grid({ 
      template: [15, '1*', 15], 
      justify: 'space-between',
      columnGap: 1,
      spaceBetween: { char: '─', color: 'brightBlack' }
    },
      style({ color: 'blue', backgroundColor: 'brightBlack' }, ` ⎇ ${branch} `),
      style({ color: 'brightBlack' }, ''), // Empty middle (filled by spaceBetween)
      style({ color: 'green', backgroundColor: 'brightBlack' }, ` ${status} `)
    )
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Show current width
  r.add(
    grid({ template: ['1*'] },
      grid({ template: [20, '1*'], columnGap: 2 },
        style({ color: 'brightBlack' }, 'Width:'),
        style({ color: 'yellow' }, `${r.width} columns`)
      )
    )
  );

  // Update on resize
  const updateDisplay = () => {
    r.set(
      grid({ 
        template: [15, '1*', 15], 
        justify: 'space-between',
        columnGap: 1,
        spaceBetween: { char: '─', color: 'brightBlack' }
      },
        style({ color: 'blue', backgroundColor: 'brightBlack' }, ` ⎇ ${branch} `),
        style({ color: 'brightBlack' }, ''),
        style({ color: 'green', backgroundColor: 'brightBlack' }, ` ${status} `)
      ),
      grid({ template: [20, '1*'], columnGap: 2 },
        style({ color: 'brightBlack' }, 'Width:'),
        style({ color: 'yellow' }, `${r.width} columns`)
      )
    );
  };

  process.stdout.on('resize', updateDisplay);

  await waitForSpacebar(r);

  process.stdout.removeListener('resize', updateDisplay);
  r.destroy(true);
}

main().catch(console.error);

