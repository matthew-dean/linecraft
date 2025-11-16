import { createRegion, flex, col, color, createJustifyBetween, createBadge, createResponsive } from '../src/ts/index';
import { showPrompt } from '../src/ts/components/prompt';

async function main() {
  const region = createRegion();

  // Simulate OhMyZsh-style prompt:
  // [branch] ──────────────────────────────── [status]
  // When resized small: [branch]

  const branch = 'main';
  const status = '✓';

  region.set(
    createJustifyBetween(region, {
      left: createBadge(region, {
        text: branch,
        bgColor: 'blue',
        textColor: 'white',
        icon: '⎇',
      }),
      right: createBadge(region, {
        text: status,
        bgColor: 'green',
        textColor: 'white',
      }),
      fillChar: '─',
      fillStyle: 'single',
      minWidthForRight: 50, // Hide right element if width < 50
    })
  );

  // Show current width
  const widthInfo = col({ width: 20 }, color('brightBlack', `Width: ${region.width}`));
  
  // Update on resize
  const updateDisplay = () => {
    region.set(
      flex({ gap: 1 },
        createJustifyBetween(region, {
          left: createBadge(region, {
            text: branch,
            bgColor: 'blue',
            textColor: 'white',
            icon: '⎇',
          }),
          right: createBadge(region, {
            text: status,
            bgColor: 'green',
            textColor: 'white',
          }),
          fillChar: '─',
          fillStyle: 'single',
          minWidthForRight: 50,
        }),
        col({ width: 20 }, color('brightBlack', `Width: ${region.width}`))
      )
    );
  };

  process.stdout.on('resize', updateDisplay);

  await showPrompt(region, {
    message: 'continue',
    key: 'SPACEBAR',
  });

  process.stdout.off('resize', updateDisplay);
  region.destroy(true);
}

main().catch(console.error);

