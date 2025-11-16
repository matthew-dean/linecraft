// Basic progress bar example using grid system

import { region, grid, style, progressBar } from '../src/ts/index';
import { waitForSpacebar } from '../src/ts/utils/wait-for-spacebar';

async function main() {
  const r = region(); // Auto-resize enabled

  for (let i = 0; i <= 100; i++) {
    r.set(
      grid({ template: [20, '1*'] },
        style({ color: 'cyan' }, 'Installing packages...'),
        progressBar({
          current: i,
          total: 100,
          barColor: 'green',
          bracketColor: 'brightBlack',
          percentColor: 'yellow'
        })
      )
    );
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  await waitForSpacebar(r);
  r.destroy(true);
}

main().catch(console.error);

