// Progress bar examples

import { Region, Grid, Styled, progressBar, Section, prompt } from '../src/index';

async function main() {
  const r = Region();

  // Example 1: Basic progress bar
  r.set(
    Section({ title: 'Basic Progress Bar' },
      Grid({ template: [20, '1*'], columnGap: 2 },
        Styled({ color: 'accent' }, 'Installing packages'),
        progressBar({
          current: 0,
          total: 100,
          barColor: 'success',
          bracketColor: 'muted',
          percentColor: 'warning'
        })
      )
    )
  );

  for (let i = 0; i <= 100; i++) {
    r.set(
      Section({ title: 'Basic Progress Bar' },
        Grid({ template: [20, '1*'], columnGap: 2 },
          Styled({ color: 'accent' }, 'Installing packages'),
          progressBar({
            current: i,
            total: 100,
            barColor: 'success',
            bracketColor: 'muted',
            percentColor: 'warning'
          })
        )
      )
    );
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  await prompt(r, { message: 'next example' });

  // Example 2: Multi-lane progress bars
  let downloadProgress = 0;
  let extractProgress = 0;
  let installProgress = 0;

  function updateAll() {
    r.set(
      Section({ title: 'Multi-Lane Progress Bars' },
        Grid({ template: ['1*'], columnGap: 0 },
          // Downloading
          Grid({ template: [12, '1*'], columnGap: 2 },
            Styled({ color: 'info' }, 'Downloading'),
            progressBar({
              current: downloadProgress,
              total: 100,
              barColor: 'accent',
              bracketColor: 'muted',
              percentColor: 'warning'
            })
          ),
          // Extracting
          Grid({ template: [12, '1*'], columnGap: 2 },
            Styled({ color: 'info' }, 'Extracting'),
            progressBar({
              current: extractProgress,
              total: 100,
              barColor: 'accent',
              bracketColor: 'muted',
              percentColor: 'warning'
            })
          ),
          // Installing
          Grid({ template: [12, '1*'], columnGap: 2 },
            Styled({ color: 'info' }, 'Installing'),
            progressBar({
              current: installProgress,
              total: 100,
              barColor: 'accent',
              bracketColor: 'muted',
              percentColor: 'warning'
            })
          )
        )
      )
    );
  }

  // Update concurrently
  await Promise.all([
    (async () => {
      for (let i = 0; i <= 100; i++) {
        downloadProgress = i;
        updateAll();
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
      }
    })(),
    (async () => {
      for (let i = 0; i <= 100; i++) {
        extractProgress = i;
        updateAll();
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
      }
    })(),
    (async () => {
      for (let i = 0; i <= 100; i++) {
        installProgress = i;
        updateAll();
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
      }
    })(),
  ]);

  await prompt(r, { message: 'exit' });
  r.destroy(true);
}

main().catch(console.error);
