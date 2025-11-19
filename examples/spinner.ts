// Spinner example using grid

import { Region, Grid, Styled, Spinner, prompt } from '../src/index';

async function main() {
  const r = Region();

  // Create spinner component (starts animating automatically)
  const spinner = Spinner({
    color: 'yellow',
  });

  // Add spinner and label using grid
  r.set(
    Grid({ template: [3, '1*'], columnGap: 1 },
      spinner,
      Styled({ color: 'cyan' }, 'Loading...')
    )
  );

  // Simulate work (spinner is already animating)
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Stop the spinner
  spinner.stop();
  
  // Show example of restarting after a prompt
  await prompt(r, { message: 'restart spinner', key: 'enter' });
  
  spinner.start();
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  spinner.stop();

  r.set(
    Grid({ template: ['1*'] },
      Styled({ color: 'green' }, '✓ Complete!')
    )
  );

  await prompt(r);
  r.destroy(true);
}

main().catch(console.error);

