// Functional components example using grid

import { region, grid, style } from '../src/index';
import { waitForSpacebar } from '../src/utils/wait-for-spacebar';
import type { Component } from '../src/layout/grid';

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

  return style({ color: colors[status] }, `${icons[status]} ${status}`);
}

// Create a component that takes props
function progressIndicator(current: number, total: number): Component {
  const percent = Math.floor((current / total) * 100);
  const filled = Math.floor(percent / 10);
  const empty = 10 - filled;
  
  return style({ color: 'green' }, 
    '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent}%`
  );
}

async function main() {
  const r = region();

  // Use functional components
  r.set(
    grid({ template: ['1*'], columnGap: 1 },
      grid({ template: [20, '1*'], columnGap: 2 },
        style({ color: 'cyan' }, 'Server Status:'),
        statusBadge('online')
      ),
      grid({ template: [20, '1*'], columnGap: 2 },
        style({ color: 'cyan' }, 'Database:'),
        statusBadge('online')
      ),
      grid({ template: [20, '1*'], columnGap: 2 },
        style({ color: 'cyan' }, 'Cache:'),
        statusBadge('warning')
      ),
      grid({ template: [20, '1*'], columnGap: 2 },
        style({ color: 'cyan' }, 'Progress:'),
        progressIndicator(75, 100)
      )
    )
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Update status
  r.set(
    grid({ template: ['1*'], columnGap: 1 },
      grid({ template: [20, '1*'], columnGap: 2 },
        style({ color: 'cyan' }, 'Server Status:'),
        statusBadge('online')
      ),
      grid({ template: [20, '1*'], columnGap: 2 },
        style({ color: 'cyan' }, 'Database:'),
        statusBadge('offline')
      ),
      grid({ template: [20, '1*'], columnGap: 2 },
        style({ color: 'cyan' }, 'Cache:'),
        statusBadge('online')
      ),
      grid({ template: [20, '1*'], columnGap: 2 },
        style({ color: 'cyan' }, 'Progress:'),
        progressIndicator(100, 100)
      )
    )
  );

  await waitForSpacebar(r);
  r.destroy(true);
}

main().catch(console.error);

