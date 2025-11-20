// Demo showing different Section border options

import { Region, Grid, Styled, Section, prompt } from '../src/index';

async function main() {
  const r = Region();

  // Default: all borders
  r.set(
    Section({ title: 'Default: All Borders' },
      Grid({ template: ['*'] },
        Styled({ color: 'cyan' }, 'This section has all borders visible (default behavior)')
      )
    )
  );
  await prompt(r);

  // Only left border
  r.set(
    Section({ title: 'Left Border Only', right: false, top: false, bottom: false },
      Grid({ template: ['*'] },
        Styled({ color: 'green' }, 'Only the left border is visible')
      )
    )
  );
  await prompt(r);

  // Only right border
  r.set(
    Section({ title: 'Right Border Only', left: false, top: false, bottom: false },
      Grid({ template: ['*'] },
        Styled({ color: 'yellow' }, 'Only the right border is visible')
      )
    )
  );
  await prompt(r);

  // Top and bottom only
  r.set(
    Section({ title: 'Top & Bottom Only', left: false, right: false },
      Grid({ template: ['*'] },
        Styled({ color: 'magenta' }, 'Only top and bottom borders are visible')
      )
    )
  );
  await prompt(r);

  // Left and right only
  r.set(
    Section({ title: 'Left & Right Only', top: false, bottom: false },
      Grid({ template: ['*'] },
        Styled({ color: 'cyan' }, 'Only left and right borders are visible')
      )
    )
  );
  await prompt(r);

  // Top and left only
  r.set(
    Section({ title: 'Top & Left Only', right: false, bottom: false },
      Grid({ template: ['*'] },
        Styled({ color: 'green' }, 'Top and left borders form an L-shape')
      )
    )
  );
  await prompt(r);

  // Bottom and right only
  r.set(
    Section({ title: 'Bottom & Right Only', left: false, top: false },
      Grid({ template: ['*'] },
        Styled({ color: 'yellow' }, 'Bottom and right borders form an L-shape')
      )
    )
  );
  await prompt(r);

  // Only top border
  r.set(
    Section({ title: 'Top Border Only', left: false, right: false, bottom: false },
      Grid({ template: ['*'] },
        Styled({ color: 'magenta' }, 'Only the top border is visible')
      )
    )
  );
  await prompt(r);

  // Only bottom border
  r.set(
    Section({ title: 'Bottom Border Only', left: false, right: false, top: false },
      Grid({ template: ['*'] },
        Styled({ color: 'cyan' }, 'Only the bottom border is visible')
      )
    )
  );
  await prompt(r);

  r.destroy(true);
}

main().catch(console.error);

