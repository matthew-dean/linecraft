// Test to show all braille dot combinations for spinner selection

import { Region, Grid, Styled, Section, prompt } from '../src/index';

async function main() {
  const r = Region();

  // All braille characters organized by pattern
  // Left column only (dots 1, 2, 3) - these are the ones typically used for spinners
  const leftColumnBraille = [
    { char: '⠁', desc: 'Dot 1 (top)' },
    { char: '⠂', desc: 'Dot 2 (middle)' },
    { char: '⠃', desc: 'Dots 1+2 (top+middle)' },
    { char: '⠄', desc: 'Dot 3 (bottom)' },
    { char: '⠅', desc: 'Dots 1+3 (top+bottom)' },
    { char: '⠆', desc: 'Dots 2+3 (middle+bottom)' },
    { char: '⠇', desc: 'Dots 1+2+3 (all left column)' },
  ];

  r.set(
    Section({ title: 'Left Column Braille Characters (for spinners)' },
      Grid({ template: ['*'] },
        ...leftColumnBraille.map(b => 
          Styled({ color: 'green', bold: true }, `${b.char}  ${b.desc}`)
        )
      )
    )
  );
  await prompt(r, { message: 'next' });

  // Show patterns with 3 dots that loop through rows
  // Braille has 6 positions: Top(1,4), Middle(2,5), Bottom(3,6)
  // To show 3 dots in a "row", we use both columns of that row + one from adjacent row
  r.set(
    Section({ title: '3-Dot Patterns Looping Through Rows' },
      Grid({ template: ['*'] },
        Styled({ color: 'green', bold: true }, 'Top row (1+4+2): ⠋ = dots 1,2,4'),
        Styled({ color: 'green', bold: true }, 'Middle row (2+5+1): ⠊ = dots 2,4... wait'),
        Styled({ color: 'cyan' }, 'Need to find chars with 3 dots in specific rows'),
      )
    )
  );
  await prompt(r, { message: 'exit' });

  r.destroy(true);
}

main().catch(console.error);
