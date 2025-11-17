// Example demonstrating justify: 'space-between' for OhMyZsh-style prompts

import { region, grid, style } from '../src/index';
import { waitForSpacebar } from '../src/utils/wait-for-spacebar';

async function main() {
  const r = region();

  // OhMyZsh-style prompt: left item, flexing middle, right item
  r.set(
    grid({ 
      template: [15, '1*', 15], 
      justify: 'space-between',
      columnGap: 1
    },
      style({ color: 'green' }, 'user@host'),
      style({ color: 'brightBlack' }, '─'), // Middle filler
      style({ color: 'yellow' }, '~/projects')
    )
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Another example with different items
  r.add(
    grid({ 
      template: [20, '1*', 20], 
      justify: 'space-between',
      spaceBetween: { char: '─', color: 'brightBlack' }
    },
      style({ color: 'cyan' }, 'Left Section'),
      style({ color: 'brightBlack' }, ''), // Empty middle
      style({ color: 'magenta' }, 'Right Section')
    )
  );

  await waitForSpacebar(r);
  r.destroy(true);
}

main().catch(console.error);

