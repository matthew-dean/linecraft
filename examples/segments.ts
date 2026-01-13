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
            { content: 'Path', color: 'accent', borderStyle: 'cap' },
            { content: 'Git', color: 'success', borderStyle: 'cap' },
            { content: 'Status', color: 'warning', borderStyle: 'cap' },
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
            { content: 'Segment 1', color: 'location', borderStyle: 'brace' },
            { content: 'Segment 2', color: 'info', borderStyle: 'brace' },
            { content: 'Segment 3', color: 'warning', borderStyle: 'brace' },
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
            { content: 'First', color: 'accent', borderStyle: 'capHalf' },
            { content: 'Second', color: 'location', borderStyle: 'capHalf' },
            { content: 'Third', color: 'info', borderStyle: 'capHalf' },
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
            { content: 'Point 1', color: 'base', borderStyle: 'dot' },
            { content: 'Point 2', color: 'base', borderStyle: 'dot' },
            { content: 'Point 3', color: 'base', borderStyle: 'dot' },
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
            { content: 'Alpha', color: 'warning', borderStyle: 'asterisk' },
            { content: 'Beta', color: 'info', borderStyle: 'asterisk' },
            { content: 'Gamma', color: 'success', borderStyle: 'asterisk' },
          ],
        })
      )
    )
  );
  await prompt(r, { message: 'exit' });

  r.destroy(true);
}

main().catch(console.error);
