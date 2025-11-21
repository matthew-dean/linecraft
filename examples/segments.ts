// Segments component demo - showing the best border styles

import { Region, Grid, Segments, Section, prompt } from '../src/index';

async function main() {
  const r = Region();

  // Style 1: Half-filled circles (the favorite!)
  r.set(
    Section({ title: 'Half-Filled Circles' },
      Grid({ template: ['*'] },
        Segments({
          segments: [
            { content: 'Path', color: 'cyan', borderStyle: 'cap' },
            { content: 'Git', color: 'green', borderStyle: 'cap' },
            { content: 'Status', color: 'yellow', borderStyle: 'cap' },
          ],
        })
      )
    )
  );
  await prompt(r, { message: 'next style' });

  // Style 2: Braces (classic and clean)
  r.set(
    Section({ title: 'Braces' },
      Grid({ template: ['*'] },
        Segments({
          segments: [
            { content: 'Segment 1', color: 'magenta', borderStyle: 'brace' },
            { content: 'Segment 2', color: 'cyan', borderStyle: 'brace' },
            { content: 'Segment 3', color: 'yellow', borderStyle: 'brace' },
          ],
        })
      )
    )
  );
  await prompt(r, { message: 'next style' });

  // Style 3: Half circles (mirrored)
  r.set(
    Section({ title: 'Half Circles' },
      Grid({ template: ['*'] },
        Segments({
          segments: [
            { content: 'First', color: 'blue', borderStyle: 'capHalf' },
            { content: 'Second', color: 'magenta', borderStyle: 'capHalf' },
            { content: 'Third', color: 'cyan', borderStyle: 'capHalf' },
          ],
        })
      )
    )
  );
  await prompt(r, { message: 'next style' });

  // Style 4: Dots
  r.set(
    Section({ title: 'Dots' },
      Grid({ template: ['*'] },
        Segments({
          segments: [
            { content: 'Point 1', color: 'white', borderStyle: 'dot' },
            { content: 'Point 2', color: 'white', borderStyle: 'dot' },
            { content: 'Point 3', color: 'white', borderStyle: 'dot' },
          ],
        })
      )
    )
  );
  await prompt(r, { message: 'next style' });

  // Style 5: Asterisks
  r.set(
    Section({ title: 'Asterisks' },
      Grid({ template: ['*'] },
        Segments({
          segments: [
            { content: 'Alpha', color: 'yellow', borderStyle: 'asterisk' },
            { content: 'Beta', color: 'cyan', borderStyle: 'asterisk' },
            { content: 'Gamma', color: 'green', borderStyle: 'asterisk' },
          ],
        })
      )
    )
  );
  await prompt(r, { message: 'exit' });

  r.destroy(true);
}

main().catch(console.error);

