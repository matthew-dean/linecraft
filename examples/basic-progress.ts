import { region, flex, col, progressBar } from '../src/ts/index';
import { waitForSpacebar } from '../src/ts/utils/wait-for-spacebar';

async function main() {
  const r = region(); // Auto-resize enabled

  // Use flex layout for progress bar
  r.set(
    flex({ gap: 2 },
      col({ width: 20, color: 'cyan' }, 'Installing packages'),
      progressBar(r, {
        current: 0,
        total: 100,
        width: 50,
        barColor: 'green',
        bracketColor: 'brightBlack',
        percentColor: 'yellow'
      })
    )
  );

  for (let i = 0; i <= 100; i++) {
    r.set(
      flex({ gap: 2 },
        col({ width: 20, color: 'cyan' }, 'Installing packages'),
        progressBar(r, {
          current: i,
          total: 100,
          width: 50,
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
