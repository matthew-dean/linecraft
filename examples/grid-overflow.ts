// Example demonstrating all overflow types

import { Region, Grid, Styled, prompt } from '../src/index';

async function main() {
  const r = Region();

  const longText = 'This is a very long text that will demonstrate different overflow behaviors';

  // Ellipsis end
  r.set(
    Grid({ template: [30, 30, 30] },
      Styled({ color: 'red', overflow: 'ellipsis-end' }, longText),
      Styled({ color: 'green', overflow: 'ellipsis-start' }, longText),
      Styled({ color: 'blue', overflow: 'ellipsis-middle' }, longText)
    )
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Wrap
  r.add(
    Grid({ template: [40, 40] },
      Styled({ color: 'cyan', overflow: 'wrap' }, longText + ' ' + longText),
      Styled({ color: 'yellow', overflow: 'none' }, longText)
    )
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Mixed with colors
  r.add(
    Grid({ template: [25, 25, 25] },
      Styled({ 
        color: 'red', 
        overflow: 'ellipsis-end',
        bold: true 
      }, longText),
      Styled({ 
        color: 'green', 
        overflow: 'ellipsis-start',
        backgroundColor: 'brightBlack'
      }, longText),
      Styled({ 
        color: 'blue', 
        overflow: 'ellipsis-middle',
        underline: true
      }, longText)
    )
  );

  await prompt(r);
  r.destroy(true);
}

main().catch(console.error);

