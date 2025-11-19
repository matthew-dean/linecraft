import { Region, Grid, Styled, progressBar, prompt } from '../src/index';

async function main() {
  const r = Region(); // Auto-resize enabled

  // Use grid layout for progress bar
  for (let i = 0; i <= 100; i++) {
    r.set(
      Grid({ template: [20, '1*'], columnGap: 2 },
        Styled({ color: 'cyan' }, 'Installing packages'),
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

  await prompt(r);
  r.destroy(true);
}

main().catch(console.error);
