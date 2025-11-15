import { createRegion, flex, col, progressBar, color } from '../src/ts/index.js';
import { waitForSpacebar } from '../src/ts/utils/wait-for-spacebar.js';

async function main() {
  const region = createRegion(); // No width specified = auto-resize enabled

  let downloadProgress = 0;
  let extractProgress = 0;
  let installProgress = 0;

  function updateAll() {
    region.set(
      flex({ gap: 0, direction: 'column' },
        // Downloading
        flex({ gap: 2 },
          col({ min: 12, max: 12 }, color('cyan', 'Downloading')),
          col({ flex: 1 }, progressBar({ 
            current: downloadProgress, 
            total: 100,
            width: 40,
            barColor: 'green',
            bracketColor: 'brightBlack',
            percentColor: 'yellow'
          }))
        ),
        // Extracting
        flex({ gap: 2 },
          col({ min: 12, max: 12 }, color('cyan', 'Extracting')),
          col({ flex: 1 }, progressBar({ 
            current: extractProgress, 
            total: 100,
            width: 40,
            barColor: 'green',
            bracketColor: 'brightBlack',
            percentColor: 'yellow'
          }))
        ),
        // Installing
        flex({ gap: 2 },
          col({ min: 12, max: 12 }, color('cyan', 'Installing')),
          col({ flex: 1 }, progressBar({ 
            current: installProgress, 
            total: 100,
            width: 40,
            barColor: 'green',
            bracketColor: 'brightBlack',
            percentColor: 'yellow'
          }))
        )
      )
    );
  }

  // Set up resize handler to re-render flex layout on resize
  // The native region will update its width automatically, but we need to rebuild the flex layout
  const resizeHandler = () => {
    // Use requestAnimationFrame-like timing to ensure native region has updated its width
    // and to batch resize events
    if ((resizeHandler as any).pending) {
      return; // Already scheduled
    }
    (resizeHandler as any).pending = true;
    setTimeout(() => {
      (resizeHandler as any).pending = false;
      // Read terminal width directly - this is the source of truth
      const terminalWidth = process.stdout.isTTY && process.stdout.columns 
        ? process.stdout.columns 
        : 80;
      // Force sync region width - accessing it syncs with native region
      // But we want to ensure it matches the terminal width
      const regionWidth = region.width;
      
      // If region width doesn't match terminal width, there's a sync issue
      // The native region should have updated, but if not, we'll still use the correct width
      // because updateAll() will read region.width which should be synced
      
      // Clear all lines before rebuilding to ensure clean layout
      // This prevents merge issues when width changes significantly
      for (let i = 1; i <= region.height; i++) {
        region.clearLine(i);
      }
      // Now rebuild with new width - updateAll() will use region.width which should be synced
      // The flex layout will constrain to this width
      updateAll();
    }, 50); // Increased delay to ensure native region's resize handler has run first
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

  await waitForSpacebar();
  
  // Clean up resize handler
  process.stdout.removeListener('resize', resizeHandler);
  region.destroy(true);
}

main().catch(console.error);

