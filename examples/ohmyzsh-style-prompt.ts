// OhMyZsh-style prompt using grid with justify: 'space-between'

import { Region, Grid, Styled, prompt } from '../src/index';

async function main() {
  const r = Region();

  const branch = 'main';
  const status = '✓';

  // OhMyZsh-style prompt: [branch] ──────────────────────────────── [status]
  // Using justify: 'space-between' to pin left and right items
  r.set(
    Grid({ 
      template: [15, '1*', 15], 
      justify: 'space-between',
      columnGap: 1,
      spaceBetween: { char: '─', color: 'brightBlack' }
    },
      Styled({ color: 'blue', backgroundColor: 'brightBlack' }, ` ⎇ ${branch} `),
      Styled({ color: 'brightBlack' }, ''), // Empty middle (filled by spaceBetween)
      Styled({ color: 'green', backgroundColor: 'brightBlack' }, ` ${status} `)
    )
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Show current width
  r.add(
    Grid({ template: ['1*'] },
      Grid({ template: [20, '1*'], columnGap: 2 },
        Styled({ color: 'brightBlack' }, 'Width:'),
        Styled({ color: 'yellow' }, `${r.width} columns`)
      )
    )
  );

  // Update on resize
  const updateDisplay = () => {
    r.set(
      Grid({ 
        template: [15, '1*', 15], 
        justify: 'space-between',
        columnGap: 1,
        spaceBetween: { char: '─', color: 'brightBlack' }
      },
        Styled({ color: 'blue', backgroundColor: 'brightBlack' }, ` ⎇ ${branch} `),
        Styled({ color: 'brightBlack' }, ''),
        Styled({ color: 'green', backgroundColor: 'brightBlack' }, ` ${status} `)
      ),
      Grid({ template: [20, '1*'], columnGap: 2 },
        Styled({ color: 'brightBlack' }, 'Width:'),
        Styled({ color: 'yellow' }, `${r.width} columns`)
      )
    );
  };

  process.stdout.on('resize', updateDisplay);

  await prompt(r);

  process.stdout.removeListener('resize', updateDisplay);
  r.destroy(true);
}

main().catch(console.error);

