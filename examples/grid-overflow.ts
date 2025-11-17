// Example demonstrating all overflow types

import { region, grid, style } from '../src/index';
import { waitForSpacebar } from '../src/utils/wait-for-spacebar';

async function main() {
  const r = region();

  const longText = 'This is a very long text that will demonstrate different overflow behaviors';

  // Ellipsis end
  r.set(
    grid({ template: [30, 30, 30] },
      style({ color: 'red', overflow: 'ellipsis-end' }, longText),
      style({ color: 'green', overflow: 'ellipsis-start' }, longText),
      style({ color: 'blue', overflow: 'ellipsis-middle' }, longText)
    )
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Wrap
  r.add(
    grid({ template: [40, 40] },
      style({ color: 'cyan', overflow: 'wrap' }, longText + ' ' + longText),
      style({ color: 'yellow', overflow: 'none' }, longText)
    )
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Mixed with colors
  r.add(
    grid({ template: [25, 25, 25] },
      style({ 
        color: 'red', 
        overflow: 'ellipsis-end',
        bold: true 
      }, longText),
      style({ 
        color: 'green', 
        overflow: 'ellipsis-start',
        backgroundColor: 'brightBlack'
      }, longText),
      style({ 
        color: 'blue', 
        overflow: 'ellipsis-middle',
        underline: true
      }, longText)
    )
  );

  await waitForSpacebar(r);
  r.destroy(true);
}

main().catch(console.error);

