import { createRegion, flex, col, color, progressBar } from '../src/ts/index';
import { showPrompt } from '../src/ts/components/prompt';

async function main() {
  const region = createRegion();

  // Test 1: Basic gap
  region.set(
    flex({ gap: 2 },
      col({ width: 10 }, color('cyan', 'Left')),
      col({ width: 10 }, color('green', 'Right'))
    )
  );
  await showPrompt(region, { message: 'see gap of 2', key: 'SPACEBAR' });

  // Test 2: Progress bar with gap (should have 1 char gap between bar and percent)
  region.set(
    flex({ gap: 0 },
      col({ width: 20 }, color('cyan', 'Installing packages')),
      progressBar(region, {
        current: 50,
        total: 100,
        barColor: 'green',
        bracketColor: 'brightBlack',
        percentColor: 'yellow'
      })
    )
  );
  await showPrompt(region, { message: 'see progress bar gap', key: 'SPACEBAR' });

  // Test 3: Gap of different sizes
  for (const gapSize of [0, 1, 2, 3]) {
    region.set(
      flex({ gap: gapSize },
        col({ width: 10 }, color('red', 'A')),
        col({ width: 10 }, color('blue', 'B')),
        col({ width: 10 }, color('green', 'C'))
      )
    );
    await showPrompt(region, { message: `see gap of ${gapSize}`, key: 'SPACEBAR' });
  }

  region.destroy(true);
}

main().catch(console.error);

