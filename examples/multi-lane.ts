import { createRegion, flex, col, progressBar, color } from '../src/ts/index.js';
import { waitForSpacebar } from '../src/ts/utils/wait-for-spacebar.js';

async function main() {
  const region = createRegion(); // No width specified = auto-resize enabled

  let downloadProgress = 0;
  let extractProgress = 0;
  let installProgress = 0;

  function updateAll() {
    region.set(
      flex({ gap: 0 },
        // Downloading
        flex({ gap: 2 },
          col({ min: 12, max: 12 }, color('cyan', 'Downloading')),
          progressBar(region, { 
            current: downloadProgress, 
            total: 100,
            width: 40,
            barColor: 'green',
            bracketColor: 'brightBlack',
            percentColor: 'yellow',
            flex: 1
          })
        ),
        // Extracting
        flex({ gap: 2 },
          col({ min: 12, max: 12 }, color('cyan', 'Extracting')),
          progressBar(region, { 
            current: extractProgress, 
            total: 100,
            width: 40,
            barColor: 'green',
            bracketColor: 'brightBlack',
            percentColor: 'yellow',
            flex: 1
          })
        ),
        // Installing
        flex({ gap: 2 },
          col({ min: 12, max: 12 }, color('cyan', 'Installing')),
          progressBar(region, { 
            current: installProgress, 
            total: 100,
            width: 40,
            barColor: 'green',
            bracketColor: 'brightBlack',
            percentColor: 'yellow',
            flex: 1
          })
        )
      )
    );
  }

  // Set up resize handler to re-render flex layout on resize
  // Flex layout will automatically adapt to new width
  const resizeHandler = () => {
    if ((resizeHandler as any).pending) {
      return; // Already scheduled
    }
    (resizeHandler as any).pending = true;
    setTimeout(() => {
      (resizeHandler as any).pending = false;
      // Flex layout will automatically use the new region.width
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

  await waitForSpacebar(region);
  
  // Clean up resize handler
  process.stdout.removeListener('resize', resizeHandler);
  region.destroy(true);
}

main().catch(console.error);

