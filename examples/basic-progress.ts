import { createRegion, createProgressBar } from '../src/ts';

async function main() {
  const region = createRegion({ width: 80 });
  const progress = createProgressBar(region, 1, {
    label: 'Installing packages',
    width: 50,
  });

  for (let i = 0; i <= 100; i++) {
    progress.update(i, 100);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  progress.finish();
  await new Promise(resolve => setTimeout(resolve, 1000));
  region.destroy();
}

main().catch(console.error);

