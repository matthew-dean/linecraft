import { createRegion, createProgressBar } from '../src/ts/index.js';

async function updateProgress(progress: ReturnType<typeof createProgressBar>, total: number) {
  for (let i = 0; i <= total; i++) {
    progress.update(i, total);
    await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
  }
}

async function main() {
  const region = createRegion({ width: 80 });

  const download = createProgressBar(region, 1, { label: 'Downloading' });
  const extract = createProgressBar(region, 2, { label: 'Extracting' });
  const install = createProgressBar(region, 3, { label: 'Installing' });

  // Update lanes concurrently
  await Promise.all([
    updateProgress(download, 100),
    updateProgress(extract, 100),
    updateProgress(install, 100),
  ]);

  await new Promise(resolve => setTimeout(resolve, 1000));
  region.destroy();
}

main().catch(console.error);

