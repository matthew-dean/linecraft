import { createRegion, flex, col, color, divider, showPrompt } from '../src/ts/index';
import { createResponsive } from '../src/ts/index';
import { createBadge } from '../src/ts/index';

async function main() {
  const region = createRegion();

  // Helper to create a visual placeholder column (colored block)
  const visualBlock = (width: number, blockColor: string, label: string = '') => {
    return col({ width, bg: '█' }, color(blockColor, label));
  };

  // Helper to create a labeled section with visual representation below
  let isFirstSection = true;
  const section = (title: string, content: any, visualContent?: any) => {
    const contentLine = flex({ gap: 0 },
      col({ width: 25 }, color('brightBlack', title + ':')),
      content
    );
    
    if (visualContent) {
      const visualLine = flex({ gap: 0 },
        col({ width: 25 }, color('brightBlack', '')),
        visualContent
      );
      
      // First section uses set(), subsequent sections use add() to append
      if (isFirstSection) {
        region.set(contentLine, visualLine);
        isFirstSection = false;
      } else {
        region.add(contentLine, visualLine);
      }
    } else {
      if (isFirstSection) {
        region.set(contentLine);
        isFirstSection = false;
      } else {
        region.add(contentLine);
      }
    }
  };

  // Test 1: Hide element when width < 50
  const hideContent = flex({ gap: 1 },
    col({ width: 15 }, color('cyan', 'Always visible')),
    createResponsive(region,
      col({ width: 20 }, color('green', 'Hidden < 50')),
      { minWidth: 50 }
    ),
    col({ flex: 1 }, color('yellow', 'Flexible'))
  );
  const hideVisual = flex({ gap: 1 },
    visualBlock(15, 'cyan', ' always'),
    col({ width: 20 }, color('brightBlack', '░░░')), // Hidden indicator
    col({ flex: 1, bg: '█' }, color('yellow', ' flex'))
  );
  section('Hide if < 50', hideContent, hideVisual);
  await showPrompt(region, { message: 'resize to see element hide at < 50', key: 'SPACEBAR' });

  // Test 2: Show different content based on width
  const responsiveContent = flex({ gap: 1 },
    col({ width: 15 }, color('cyan', 'Status:')),
    createResponsive(region,
      col({ width: 30 }, color('green', 'Full status message here')),
      { minWidth: 60, fallback: col({ width: 10 }, color('yellow', 'Short')) }
    )
  );
  const responsiveVisual = flex({ gap: 1 },
    visualBlock(15, 'cyan', ' label'),
    col({ width: 30, bg: '█' }, color('green', ' full'))
  );
  section('Responsive Content', responsiveContent, responsiveVisual);
  await showPrompt(region, { message: 'resize to see content change', key: 'SPACEBAR' });

  // Test 3: Multiple responsive elements
  const multiContent = flex({ gap: 1 },
    col({ width: 10 }, color('cyan', 'Left')),
    createResponsive(region,
      col({ width: 15 }, color('green', 'Middle 1')),
      { minWidth: 50 }
    ),
    createResponsive(region,
      col({ width: 15 }, color('yellow', 'Middle 2')),
      { minWidth: 70 }
    ),
    createResponsive(region,
      col({ width: 15 }, color('magenta', 'Right')),
      { minWidth: 90 }
    )
  );
  const multiVisual = flex({ gap: 1 },
    visualBlock(10, 'cyan', ' left'),
    col({ width: 15, bg: '█' }, color('green', ' 1')),
    col({ width: 15, bg: '█' }, color('yellow', ' 2')),
    col({ width: 15, bg: '█' }, color('magenta', ' 3'))
  );
  section('Multiple Responsive', multiContent, multiVisual);
  await showPrompt(region, { message: 'resize to see elements hide progressively', key: 'SPACEBAR' });

  // Test 4: Responsive badges (like OhMyZsh style)
  const badgeContent = flex({ gap: 0 },
    createBadge(region, { text: 'main', bgColor: 'blue', textColor: 'white', icon: '⎇' }),
    createResponsive(region,
      divider({ fillChar: '─', style: 'single', color: 'brightBlack' }),
      { minWidth: 60 }
    ),
    createResponsive(region,
      createBadge(region, { text: '✓', bgColor: 'green', textColor: 'white' }),
      { minWidth: 50 }
    )
  );
  const badgeVisual = flex({ gap: 0 },
    col({ width: 8 }, color('blue', '█ badge')),
    col({ width: 1 }, color('brightBlack', '│')),
    col({ width: 8 }, color('green', '█ badge'))
  );
  section('Responsive Badges', badgeContent, badgeVisual);
  await showPrompt(region, { message: 'resize to see badges hide', key: 'SPACEBAR' });

  // Test 5: Max width constraint (hide if too wide)
  const maxContent = flex({ gap: 1 },
    col({ flex: 1 }, color('cyan', 'Left column')),
    createResponsive(region,
      col({ width: 30 }, color('green', 'Hidden if > 100')),
      { maxWidth: 100 }
    ),
    col({ flex: 1 }, color('yellow', 'Right column'))
  );
  const maxVisual = flex({ gap: 1 },
    col({ flex: 1, bg: '█' }, color('cyan', ' left')),
    col({ width: 30, bg: '█' }, color('green', ' mid')),
    col({ flex: 1, bg: '█' }, color('yellow', ' right'))
  );
  section('Max Width Hide', maxContent, maxVisual);
  await showPrompt(region, { message: 'resize wide to see element hide', key: 'SPACEBAR' });

  // Test 6: Width range (show only in specific range)
  let width = region.width;
  const rangeContent = flex({ gap: 1 },
    col({ width: 15 }, color('cyan', 'Width:')),
    col({ width: 10 }, color('yellow', String(region.width))),
    createResponsive(region,
      col({ width: 25 }, color('green', 'Visible 60-100 only')),
      { minWidth: 60, maxWidth: 100 }
    )
  );
  const rangeVisual = flex({ gap: 1 },
    visualBlock(15, 'cyan', ' label'),
    visualBlock(10, 'yellow', ` ${width}`),
    col({ width: 25, bg: '█' }, color('green', ' range'))
  );
  section('Width Range', rangeContent, rangeVisual);

  // Update on resize
  const resizeHandler = () => {
    width = region.width;
    const rangeContent = flex({ gap: 1 },
      col({ width: 15 }, color('cyan', 'Width:')),
      col({ width: 10 }, color('yellow', String(region.width))),
      createResponsive(region,
        col({ width: 25 }, color('green', 'Visible 60-100 only')),
        { minWidth: 60, maxWidth: 100 }
      )
    );
    const rangeVisual = flex({ gap: 1 },
      visualBlock(15, 'cyan', ' label'),
      visualBlock(10, 'yellow', ` ${width}`),
      col({ width: 25, bg: '█' }, color('green', ' range'))
    );
    section('Width Range', rangeContent, rangeVisual);
  };
  process.stdout.on('resize', resizeHandler);

  await showPrompt(region, { message: 'resize to see element show/hide in range', key: 'SPACEBAR' });
  
  process.stdout.off('resize', resizeHandler);
  region.destroy(true);
}

main().catch(console.error);
