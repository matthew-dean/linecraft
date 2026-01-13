// Reactive resize example using grid

import { Region, Grid, Styled, prompt } from '../src/index';

async function main() {
  const r = Region();

  function updateDisplay() {
    r.set(
      Grid({ template: ['1*'] },
        Grid({ template: [20, '1*'], columnGap: 2 },
          Styled({ color: 'accent' }, 'Terminal width:'),
          Styled({ color: 'warning' }, `${r.width} columns`)
        ),
        Grid({ template: [20, '1*'], columnGap: 2 },
          Styled({ color: 'accent' }, 'Terminal height:'),
          Styled({ color: 'warning' }, `${r.height} rows`)
        ),
        Grid({ template: ['1*'] },
          Styled({ color: 'muted' }, '─'.repeat(Math.min(80, r.width)))
        ),
        Grid({ template: ['1*'] },
          Styled({ color: 'success' }, 'Resize the terminal to see it update!')
        )
      )
    );
  }

  // Initial display
  updateDisplay();

  // Update on resize
  const resizeHandler = () => {
    updateDisplay();
  };
  process.stdout.on('resize', resizeHandler);

  await prompt(r);

  process.stdout.removeListener('resize', resizeHandler);
  r.destroy(true);
}

main().catch(console.error);

