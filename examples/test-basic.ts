// Simple test to verify the Node.js API works
import { createRegion } from '../src/ts/index.js';

console.log('Creating region...');
const region = createRegion({ x: 0, y: 0, width: 80, height: 1 });

console.log('Setting line 1...');
region.setLine(1, 'Hello from EchoKit!');

console.log('Setting line 2 (should expand)...');
region.setLine(2, 'This is line 2');

console.log('Setting multiple lines...');
region.set('Line 1\nLine 2\nLine 3');

console.log('Flushing...');
region.flush();

console.log('Cleaning up...');
region.destroy();

console.log('Test complete!');

