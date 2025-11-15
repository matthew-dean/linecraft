import { createRegion } from '../src/ts';
import { waitForSpacebar } from '../src/ts/utils/wait-for-spacebar.js';

async function main() {
  console.log('Creating a region...\n');
  
  const region = createRegion({ width: 80, height: 5 });
  
  // Demo 1: Set individual lines
  console.log('Demo 1: Setting individual lines');
  region.setLine(1, 'Line 1: Hello from linecraft!');
  region.setLine(2, 'Line 2: This is a terminal region');
  region.setLine(3, 'Line 3: You can update each line independently');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Demo 2: Update specific lines
  console.log('\nDemo 2: Updating specific lines');
  region.setLine(2, 'Line 2: UPDATED - This line changed!');
  region.setLine(4, 'Line 4: This is a new line (region expands automatically)');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Demo 3: Set multiple lines at once
  console.log('\nDemo 3: Setting multiple lines at once');
  region.set([
    { text: 'Line 1: Multi-line update', style: { color: 'green' } },
    { text: 'Line 2: With styling support', style: { color: 'yellow' } },
    { text: 'Line 3: And automatic formatting', style: { color: 'cyan' } },
  ]);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Demo 4: Clear and update
  console.log('\nDemo 4: Clearing and updating');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  region.setLine(1, 'Region cleared!');
  region.setLine(2, 'Starting fresh...');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Demo 5: Animated updates
  console.log('\nDemo 5: Animated line updates');
  const messages = [
    'Loading...',
    'Processing...',
    'Almost done...',
    'Complete!',
  ];
  
  for (let i = 0; i < messages.length; i++) {
    region.setLine(1, `Status: ${messages[i]}`);
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Demo 6: Multiple lines updating
  console.log('\nDemo 6: Multiple lines updating simultaneously');
  for (let i = 0; i < 5; i++) {
    region.setLine(1, `Counter 1: ${i * 2}`);
    region.setLine(2, `Counter 2: ${i * 3}`);
    region.setLine(3, `Counter 3: ${i * 5}`);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Final message
  region.setLine(1, 'Demo complete!');
  region.setLine(2, 'Press SPACEBAR to exit...');
  await waitForSpacebar();
  
  region.destroy(true);
  console.log('\nRegion destroyed. Demo finished!');
}

main().catch(console.error);

