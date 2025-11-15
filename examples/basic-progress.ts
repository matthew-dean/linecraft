import { createRegion, flex, col, progressBar, color } from '../src/ts/index.js';
import { waitForSpacebar } from '../src/ts/utils/wait-for-spacebar.js';

async function main() {
  const region = createRegion(); // Auto-resize enabled

  // Use flex layout for progress bar
  region.set(
    flex({ gap: 2 },
      col({ width: 20 }, color('cyan', 'Installing packages')),
      progressBar(region, {
        current: 0,
        total: 100,
        width: 50,
        barColor: 'green',
        bracketColor: 'brightBlack',
        percentColor: 'yellow'
      })
    )
  );

  for (let i = 0; i <= 100; i++) {
    region.set(
      flex({ gap: 2 },
        col({ width: 20 }, color('cyan', 'Installing packages')),
        progressBar(region, {
          current: i,
          total: 100,
          width: 50,
          barColor: 'green',
          bracketColor: 'brightBlack',
          percentColor: 'yellow'
        })
      )
    );
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  await waitForSpacebar(region);
  region.destroy(true);
}

main().catch(console.error);
