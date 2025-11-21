// Spinner example showing different animation styles

import { Region, Grid, Styled, Spinner, Section, prompt } from '../src/index';

async function main() {
  const r = Region();

  // Style 1a: Classic dots (pnpm-style) - Loop 1: Top ↔ Middle
  // Pattern: 3 dots always visible, looping between top and middle rows
  // Braille: ⠋ (1,2,4) = 2 top + 1 middle, ⠓ (1,2,5) = 1 top + 2 middle
  r.set(
    Section({ title: 'Classic Dots - Top ↔ Middle Loop' },
      Grid({ template: [3, '1*'], columnGap: 1 },
        Spinner({
          frames: ['⠋', '⠓', '⠋', '⠓'], // Top → Middle → Top → Middle
          interval: 100,
          color: 'green',
        }),
        Styled({ color: 'white' }, 'Installing packages...')
      )
    )
  );
  await new Promise(resolve => setTimeout(resolve, 3000));
  await prompt(r, { message: 'next loop' });

  // Style 1b: Classic dots (pnpm-style) - Loop 2: Middle ↔ Bottom
  // Pattern: 3 dots always visible, looping between middle and bottom rows
  // Braille: ⠓ (1,2,5) = 1 top + 2 middle, ⠴ (3,5,6) = 1 middle + 2 bottom
  r.set(
    Section({ title: 'Classic Dots - Middle ↔ Bottom Loop' },
      Grid({ template: [3, '1*'], columnGap: 1 },
        Spinner({
          frames: ['⠓', '⠴', '⠓', '⠴'], // Middle → Bottom → Middle → Bottom
          interval: 100,
          color: 'green',
        }),
        Styled({ color: 'white' }, 'Installing packages...')
      )
    )
  );
  await new Promise(resolve => setTimeout(resolve, 3000));
  await prompt(r, { message: 'next style' });

  // Style 2: Braille wave
  r.set(
    Section({ title: 'Braille Wave' },
      Grid({ template: [3, '1*'], columnGap: 1 },
        Spinner({
          interval: 80,
          color: 'yellow',
        }),
        Styled({ color: 'yellow' }, 'Processing...')
      )
    )
  );
  await new Promise(resolve => setTimeout(resolve, 3000));
  await prompt(r, { message: 'next style' });

  // Style 3: Arrows
  r.set(
    Section({ title: 'Arrows' },
      Grid({ template: [3, '1*'], columnGap: 1 },
        Spinner({
          frames: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
          interval: 100,
          color: 'green',
        }),
        Styled({ color: 'green' }, 'Loading...')
      )
    )
  );
  await new Promise(resolve => setTimeout(resolve, 3000));
  await prompt(r, { message: 'next style' });

  // Style 4: Bouncing bar
  r.set(
    Section({ title: 'Bouncing Bar' },
      Grid({ template: [3, '1*'], columnGap: 1 },
        Spinner({
          frames: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂'],
          interval: 80,
          color: 'magenta',
        }),
        Styled({ color: 'magenta' }, 'Working...')
      )
    )
  );
  await new Promise(resolve => setTimeout(resolve, 3000));
  await prompt(r, { message: 'next style' });

  // Style 5: Clock
  r.set(
    Section({ title: 'Clock' },
      Grid({ template: [3, '1*'], columnGap: 1 },
        Spinner({
          frames: ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'],
          interval: 100,
          color: 'brightCyan',
        }),
        Styled({ color: 'brightCyan' }, 'Waiting...')
      )
    )
  );
  await new Promise(resolve => setTimeout(resolve, 3000));
  await prompt(r, { message: 'exit' });

  r.destroy(true);
}

main().catch(console.error);
