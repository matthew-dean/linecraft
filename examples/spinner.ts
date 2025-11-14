import { createRegion, createSpinner } from '../src/ts/index.js';

async function main() {
  const region = createRegion({ width: 80 });
  const spinner = createSpinner(region, 1);

  spinner.setText('Processing...');
  spinner.start();

  // Simulate work
  await new Promise(resolve => setTimeout(resolve, 3000));

  spinner.stop();
  region.setLine(1, '✓ Done!');
  await new Promise(resolve => setTimeout(resolve, 1000));
  region.destroy();
}

main().catch(console.error);

