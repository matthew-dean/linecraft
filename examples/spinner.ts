// Spinner example showing different animation styles

import { Region, Grid, Styled, Spinner, Section, prompt } from '../src/index';

async function main() {
  const r = Region();

  // Style 1: Classic dots (pnpm-style) - Clockwise rotation
  // Pattern: 3 connected dots rotating clockwise through the braille grid
  // Sequence: ⠙ (1,4,5) → ⠜ (4,5,3) → ⠴ (5,3,6) → ⠦ (3,6,2) → ⠣ (6,2,1) → ⠋ (2,1,4) → loop
  r.set(
    Section({ title: 'Classic Dots (pnpm-style) - Clockwise Rotation' },
      Grid({ template: [3, '1*'], columnGap: 1 },
        Spinner({
          frames: ['⠙', '⠜', '⠴', '⠦', '⠣', '⠋'], // Clockwise rotation with 3 connected dots
          interval: 100,
          color: 'green',
        }),
        Styled({ color: 'white' }, 'Installing packages...')
      )
    )
  );
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
  await prompt(r, { message: 'exit' });

  r.destroy(true);
}

main().catch(console.error);
