// Example demonstrating justify: 'space-between' for OhMyZsh-style prompts

import { Region, Grid, Styled, prompt } from '../src/index';

async function main() {
  const r = Region();

  // OhMyZsh-style prompt: left item, flexing middle, right item
  r.set(
    Grid({ 
      template: [15, '1*', 15], 
      justify: 'space-between',
      columnGap: 1
    },
      Styled({ color: 'green' }, 'user@host'),
      Styled({ color: 'brightBlack' }, '─'), // Middle filler
      Styled({ color: 'yellow' }, '~/projects')
    )
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Another example with different items
  r.add(
    Grid({ 
      template: [20, '1*', 20], 
      justify: 'space-between',
      spaceBetween: { char: '─', color: 'brightBlack' }
    },
      Styled({ color: 'cyan' }, 'Left Section'),
      Styled({ color: 'brightBlack' }, ''), // Empty middle
      Styled({ color: 'magenta' }, 'Right Section')
    )
  );

  await prompt(r);
  r.destroy(true);
}

main().catch(console.error);

