import { createRegion, flex, col, color } from '../src/ts/index';
import { createSpinner } from '../src/ts/index';
import { waitForSpacebar } from '../src/ts/utils/wait-for-spacebar';

async function main() {
  const region = createRegion(); // Auto-resize enabled
  const spinner = createSpinner(region, 1);

  // Use flex layout for spinner
  region.set(
    flex({ gap: 2 },
      col({}, spinner.getText()),
      col({ flex: 1 }, color('cyan', 'Processing...'))
    )
  );

  spinner.setText('Processing...');
  spinner.start();

  // Simulate work
  await new Promise(resolve => setTimeout(resolve, 3000));

  spinner.stop();
  region.set(
    flex({ gap: 2 },
      col({}, color('green', '✓')),
      col({ flex: 1 }, color('green', 'Done!'))
    )
  );
  
  await waitForSpacebar(region);
  region.destroy(true);
}

main().catch(console.error);
