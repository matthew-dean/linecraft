// Test that content persists when process exits without calling destroy()
// This should auto-flush content to the main terminal

import { Region, Styled, Section } from '../src/index';

async function main() {
  const r = Region();

  r.set(
    Section({ title: 'Auto-Flush Test' },
      Styled({ color: 'green' }, 'This content should persist after the process exits'),
      Styled({ color: 'cyan' }, 'because destroy() was not called.'),
      Styled({ color: 'yellow' }, 'The content should be visible in your terminal.')
    )
  );

  // Wait a bit so you can see it
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Exit without calling destroy() - content should auto-flush
}

main().catch(console.error);
