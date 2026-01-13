// Spinner example showing built-in animation styles

import { Region, Grid, Styled, Spinner, Section, prompt } from '../src/index';

async function main() {
  const r = Region();

  // Classic dots (pnpm-style) - Clockwise rotation with 3 connected dots
  r.set(
    Section({ title: 'Classic Dots (pnpm-style)' },
      Grid({ template: [3, '1*'], columnGap: 1 },
        Spinner({
          style: 'classic-dots',
          interval: 100,
          color: 'accent',
        }),
        Styled({ color: 'base' }, 'Installing packages...')
      )
    )
  );
  await prompt(r, { message: 'next style' });

  // Bouncing bar
  r.set(
    Section({ title: 'Bouncing Bar' },
      Grid({ template: [3, '1*'], columnGap: 1 },
        Spinner({
          style: 'bouncing-bar',
          interval: 80,
          color: 'location',
        }),
        Styled({ color: 'location' }, 'Working...')
      )
    )
  );
  await prompt(r, { message: 'exit' });

  r.destroy(true);
}

main().catch(console.error);
