// Functional components example using grid

import { Region, Grid, Styled, prompt } from '../src/index';
import type { Component } from '../src/component';

// Create a reusable component function
function statusBadge(status: 'online' | 'offline' | 'warning'): Component {
  const colors = {
    online: 'green',
    warning: 'yellow',
    offline: 'red',
  } as const;
  
  const icons = {
    online: '●',
    warning: '⚠',
    offline: '○',
  } as const;

  return Styled({ color: colors[status] }, `${icons[status]} ${status}`);
}

// Create a component that takes props
function progressIndicator(current: number, total: number): Component {
  const percent = Math.floor((current / total) * 100);
  const filled = Math.floor(percent / 10);
  const empty = 10 - filled;
  
  return Styled({ color: 'green' }, 
    '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent}%`
  );
}

async function main() {
  const r = Region();

  // Use functional components
  r.set(
    Grid({ template: ['1*'], columnGap: 1 },
      Grid({ template: [20, '1*'], columnGap: 2 },
        Styled({ color: 'cyan' }, 'Server Status:'),
        statusBadge('online')
      ),
      Grid({ template: [20, '1*'], columnGap: 2 },
        Styled({ color: 'cyan' }, 'Database:'),
        statusBadge('online')
      ),
      Grid({ template: [20, '1*'], columnGap: 2 },
        Styled({ color: 'cyan' }, 'Cache:'),
        statusBadge('warning')
      ),
      Grid({ template: [20, '1*'], columnGap: 2 },
        Styled({ color: 'cyan' }, 'Progress:'),
        progressIndicator(75, 100)
      )
    )
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Update status
  r.set(
    Grid({ template: ['1*'], columnGap: 1 },
      Grid({ template: [20, '1*'], columnGap: 2 },
        Styled({ color: 'cyan' }, 'Server Status:'),
        statusBadge('online')
      ),
      Grid({ template: [20, '1*'], columnGap: 2 },
        Styled({ color: 'cyan' }, 'Database:'),
        statusBadge('offline')
      ),
      Grid({ template: [20, '1*'], columnGap: 2 },
        Styled({ color: 'cyan' }, 'Cache:'),
        statusBadge('online')
      ),
      Grid({ template: [20, '1*'], columnGap: 2 },
        Styled({ color: 'cyan' }, 'Progress:'),
        progressIndicator(100, 100)
      )
    )
  );

  await prompt(r);
  r.destroy(true);
}

main().catch(console.error);

