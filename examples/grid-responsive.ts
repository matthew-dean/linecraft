// Example demonstrating responsive visibility with 'when' condition

import { Region, Grid, Styled, prompt } from '../src/index';

async function main() {
  const r = Region();

  // Show different content based on terminal width
  r.set(
    Grid({ template: [20, '1*'] },
      Styled({ color: 'cyan' }, 'Status:'),
      Styled({ 
        color: 'green',
        when: (ctx) => ctx.availableWidth > 50
      }, 'Connected (wide terminal)'),
      Styled({
        color: 'yellow',
        when: (ctx) => ctx.availableWidth <= 50
      }, 'Connected (narrow)')
    )
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Multiple responsive items
  r.add(
    Grid({ template: [15, 15, 15, '1*'] },
      Styled({ color: 'red' }, 'Always'),
      Styled({ 
        color: 'green',
        when: (ctx) => ctx.availableWidth > 60
      }, 'Width > 60'),
      Styled({
        color: 'blue',
        when: (ctx) => ctx.availableWidth > 80
      }, 'Width > 80'),
      Styled({ color: 'yellow' }, 'Flex')
    )
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Progress indicator that shows details only when wide
  r.add(
    Grid({ template: [20, '1*'] },
      Styled({ color: 'cyan' }, 'Processing...'),
      Styled({ 
        color: 'green',
        when: (ctx) => ctx.availableWidth > 40
      }, '████████████████ 75%')
    )
  );

  await prompt(r);
  r.destroy(true);
}

main().catch(console.error);

