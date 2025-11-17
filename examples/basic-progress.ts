import { region, grid, style, progressBar } from '../src/index';
import { waitForSpacebar } from '../src/utils/wait-for-spacebar';

async function main() {
  const r = region(); // Auto-resize enabled

  // Use grid layout for progress bar
  for (let i = 0; i <= 100; i++) {
    r.set(
      grid({ template: [20, '1*'], columnGap: 2 },
        style({ color: 'cyan' }, 'Installing packages'),
        progressBar({
          current: i,
          total: 100,
          barColor: 'green',
          bracketColor: 'brightBlack',
          percentColor: 'yellow'
        })
      )
    );
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  await waitForSpacebar(r);
  r.destroy(true);
}

main().catch(console.error);
