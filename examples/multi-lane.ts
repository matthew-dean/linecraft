// Multi-lane progress bars using grid

import { region, grid, style, progressBar } from '../src/index';
import { waitForSpacebar } from '../src/utils/wait-for-spacebar';

async function main() {
  const r = region();

  let downloadProgress = 0;
  let extractProgress = 0;
  let installProgress = 0;

  function updateAll() {
    r.set(
      grid({ template: ['1*'], columnGap: 0 },
        // Downloading
        grid({ template: [12, '1*'], columnGap: 2 },
          style({ color: 'cyan' }, 'Downloading'),
          progressBar({
            current: downloadProgress,
            total: 100,
            barColor: 'green',
            bracketColor: 'brightBlack',
            percentColor: 'yellow'
          })
        ),
        // Extracting
        grid({ template: [12, '1*'], columnGap: 2 },
          style({ color: 'cyan' }, 'Extracting'),
          progressBar({
            current: extractProgress,
            total: 100,
            barColor: 'green',
            bracketColor: 'brightBlack',
            percentColor: 'yellow'
          })
        ),
        // Installing
        grid({ template: [12, '1*'], columnGap: 2 },
          style({ color: 'cyan' }, 'Installing'),
          progressBar({
            current: installProgress,
            total: 100,
            barColor: 'green',
            bracketColor: 'brightBlack',
            percentColor: 'yellow'
          })
        )
      )
    );
  }

  // Set up resize handler
  const resizeHandler = () => {
    if ((resizeHandler as any).pending) {
      return;
    }
    (resizeHandler as any).pending = true;
    setTimeout(() => {
      (resizeHandler as any).pending = false;
      updateAll();
    }, 50);
  };
  process.stdout.on('resize', resizeHandler);

  // Update concurrently
  await Promise.all([
    (async () => {
      for (let i = 0; i <= 100; i++) {
        downloadProgress = i;
        updateAll();
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
      }
    })(),
    (async () => {
      for (let i = 0; i <= 100; i++) {
        extractProgress = i;
        updateAll();
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
      }
    })(),
    (async () => {
      for (let i = 0; i <= 100; i++) {
        installProgress = i;
        updateAll();
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
      }
    })(),
  ]);

  await waitForSpacebar(r);
  
  process.stdout.removeListener('resize', resizeHandler);
  r.destroy(true);
}

main().catch(console.error);

