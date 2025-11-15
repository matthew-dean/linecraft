import { createRegion, flex, col, color } from '../src/ts';
import { waitForSpacebar } from '../src/ts/utils/wait-for-spacebar.js';

/**
 * Example showing functional components that return arrays
 * This demonstrates the simplified API where:
 * - Simple components just return strings
 * - Functional components can return arrays (auto-flattened)
 * - Complex components (Col with options) implement Renderable
 */

// Simple functional component - just returns a string
function label(text: string) {
  return text;
}

// Functional component that returns an array
function statusBar(status: string, ...children: any[]) {
  return [
    'Status: ',
    color('green', status),
    ' | ',
    ...children
  ];
}

// Functional component with props
function card(title: string, content: string) {
  return [
    color('bold', title),
    '\n',
    content
  ];
}

async function main() {
  const region = createRegion({ width: 80 });

  // Example 1: Simple string components
  region.set(
    flex({ gap: 2 },
      'Hello',
      'World'
    )
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Example 2: Functional component returning array
  region.set(
    flex({ gap: 1 },
      ...statusBar('Connected', 'Users: 42', ' | ', 'Uptime: 1h')
    )
  );

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Example 3: Mix of strings, functional components, and Col
  region.set(
    flex({ gap: 2 },
      label('Label:'),
      col({ flex: 1 }, color('cyan', 'This column grows')),
      ...statusBar('Active', 'Tasks: 5')
    )
  );

  await waitForSpacebar();
  region.destroy(true);
}

main().catch(console.error);

