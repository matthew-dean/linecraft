// Example demonstrating responsive visibility with 'when' condition

import { region, grid, style } from '../src/index';
import { waitForSpacebar } from '../src/utils/wait-for-spacebar';

async function main() {
  const r = region();

  // Show different content based on terminal width
  r.set(
    grid({ template: [20, '1*'] },
      style({ color: 'cyan' }, 'Status:'),
      style({ 
        color: 'green',
        when: (ctx) => ctx.availableWidth > 50
      }, 'Connected (wide terminal)'),
      style({
        color: 'yellow',
        when: (ctx) => ctx.availableWidth <= 50
      }, 'Connected (narrow)')
    )
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Multiple responsive items
  r.add(
    grid({ template: [15, 15, 15, '1*'] },
      style({ color: 'red' }, 'Always'),
      style({ 
        color: 'green',
        when: (ctx) => ctx.availableWidth > 60
      }, 'Width > 60'),
      style({
        color: 'blue',
        when: (ctx) => ctx.availableWidth > 80
      }, 'Width > 80'),
      style({ color: 'yellow' }, 'Flex')
    )
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Progress indicator that shows details only when wide
  r.add(
    grid({ template: [20, '1*'] },
      style({ color: 'cyan' }, 'Processing...'),
      style({ 
        color: 'green',
        when: (ctx) => ctx.availableWidth > 40
      }, '████████████████ 75%')
    )
  );

  await waitForSpacebar(r);
  r.destroy(true);
}

main().catch(console.error);

