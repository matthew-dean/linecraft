#!/usr/bin/env node

import { readdir } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';

const examplesDir = join(process.cwd(), 'docs', 'examples');

async function main() {
  try {
    const files = await readdir(examplesDir);
    const tapeFiles = files.filter(f => f.endsWith('.tape'));
    
    if (tapeFiles.length === 0) {
      console.log('No .tape files found in docs/examples/');
      process.exit(1);
    }
    
    console.log(`Found ${tapeFiles.length} tape file(s) to record:\n`);
    
    for (const file of tapeFiles) {
      const filePath = join(examplesDir, file);
      console.log(`Recording ${file}...`);
      try {
        execSync(`vhs "${filePath}"`, { stdio: 'inherit' });
        console.log(`✓ Completed ${file}\n`);
      } catch (error) {
        console.error(`✗ Failed to record ${file}`);
        process.exit(1);
      }
    }
    
    console.log('All recordings completed!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();

