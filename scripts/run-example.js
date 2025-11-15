#!/usr/bin/env node
/**
 * Run an example by partial name match
 * Usage: node scripts/run-example.js basic-progress
 *        node scripts/run-example.js spinner
 *        node scripts/run-example.js multi
 */

import { readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const examplesDir = join(__dirname, '..', 'examples');

async function findExample(pattern) {
  const files = await readdir(examplesDir);
  // First try exact match (without .ts extension)
  // Then try starts with
  // Then try contains
  const patternLower = pattern.toLowerCase();
  const matching = files
    .filter(file => file.endsWith('.ts'))
    .map(file => ({
      file,
      name: file.replace('.ts', ''),
      nameLower: file.replace('.ts', '').toLowerCase()
    }))
    .filter(({ name, nameLower }) => 
      nameLower === patternLower || 
      nameLower.startsWith(patternLower) ||
      nameLower.includes(patternLower)
    )
    .sort((a, b) => {
      // Prefer exact matches, then starts-with, then contains
      const aExact = a.nameLower === patternLower ? 0 : (a.nameLower.startsWith(patternLower) ? 1 : 2);
      const bExact = b.nameLower === patternLower ? 0 : (b.nameLower.startsWith(patternLower) ? 1 : 2);
      if (aExact !== bExact) return aExact - bExact;
      return a.name.localeCompare(b.name);
    })
    .map(({ file }) => file);
  
  if (matching.length === 0) {
    console.error(`No example found matching "${pattern}"`);
    console.error(`Available examples:`);
    const allExamples = files
      .filter(file => file.endsWith('.ts'))
      .map(file => file.replace('.ts', ''))
      .sort();
    allExamples.forEach(name => console.error(`  - ${name}`));
    process.exit(1);
  }
  
  if (matching.length > 1) {
    console.warn(`Multiple matches found, using first: ${matching[0].replace('.ts', '')}`);
    matching.slice(1).forEach(file => {
      console.warn(`  (also matched: ${file.replace('.ts', '')})`);
    });
  }
  
  return join(examplesDir, matching[0]);
}

async function main() {
  const pattern = process.argv[2];
  
  if (!pattern) {
    console.error('Usage: pnpm example <pattern>');
    console.error('Example: pnpm example basic-progress');
    process.exit(1);
  }
  
  const exampleFile = await findExample(pattern);
  
  // Run with tsx via pnpm exec (ensures we use the local tsx)
  const proc = spawn('pnpm', ['exec', 'tsx', exampleFile], {
    stdio: 'inherit',
    shell: true,
  });
  
  proc.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

