// Reactive resize example using grid

import { region, grid, style } from '../src/index';
import { waitForSpacebar } from '../src/utils/wait-for-spacebar';

async function main() {
  const r = region();

  function updateDisplay() {
    r.set(
      grid({ template: ['1*'] },
        grid({ template: [20, '1*'], columnGap: 2 },
          style({ color: 'cyan' }, 'Terminal width:'),
          style({ color: 'yellow' }, `${r.width} columns`)
        ),
        grid({ template: [20, '1*'], columnGap: 2 },
          style({ color: 'cyan' }, 'Terminal height:'),
          style({ color: 'yellow' }, `${r.height} rows`)
        ),
        grid({ template: ['1*'] },
          style({ color: 'brightBlack' }, '─'.repeat(Math.min(80, r.width)))
        ),
        grid({ template: ['1*'] },
          style({ color: 'green' }, 'Resize the terminal to see it update!')
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

  await waitForSpacebar(r);

  process.stdout.removeListener('resize', resizeHandler);
  r.destroy(true);
}

main().catch(console.error);

