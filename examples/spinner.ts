// Spinner example using grid

import { region, grid, style } from '../src/index';
import { DemoSpinner } from './demo-spinner';
import { waitForSpacebar } from '../src/utils/wait-for-spacebar';

async function main() {
  const r = region();

  // Create spinner on line 1
  const spin = new DemoSpinner(r, 1, {
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    interval: 80,
  });

  // Add label next to spinner using grid
  r.set(
    grid({ template: [3, '1*'], columnGap: 1 },
      style({ color: 'yellow' }, '⠋'), // Spinner will update this
      style({ color: 'cyan' }, 'Loading...')
    )
  );

  // Start spinner
  spin.start();

  // Update spinner character in the grid
  let frameIndex = 0;
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const interval = setInterval(() => {
    frameIndex = (frameIndex + 1) % frames.length;
    r.set(
      grid({ template: [3, '1*'], columnGap: 1 },
        style({ color: 'yellow' }, frames[frameIndex]),
        style({ color: 'cyan' }, 'Loading...')
      )
    );
  }, 80);

  // Simulate work
  await new Promise(resolve => setTimeout(resolve, 3000));

  clearInterval(interval);
  spin.stop();

  r.set(
    grid({ template: ['1*'] },
      style({ color: 'green' }, '✓ Complete!')
    )
  );

  await waitForSpacebar(r);
  r.destroy(true);
}

main().catch(console.error);

