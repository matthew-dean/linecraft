/**
 * Visual tests for TerminalRegion
 * 
 * These tests actually render to stdout so you can see the output.
 * Run with: pnpm test region.visual
 * 
 * Note: These tests may interfere with test runner output, so they're
 * kept separate from the main test suite.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TerminalRegion } from './region';

describe('TerminalRegion (Visual)', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    // Region will automatically reserve space at the bottom
    region = new TerminalRegion({ 
      width: 80, 
      height: 5,
      disableRendering: false, // Actually render!
    });
  });

  afterEach(() => {
    if (region) {
      region.destroy();
    }
    // Small delay to see the output
    return new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should render text to the region', () => {
    region.setLine(1, 'Visual Test: Line 1');
    region.setLine(2, 'Visual Test: Line 2');
    region.setLine(3, 'Visual Test: Line 3');
    region.flush();
    
    expect(region).toBeDefined();
  });

  it('should render styled text', () => {
    region.setLine(1, {
      text: 'Styled Text',
      style: { bold: true, color: 'red' },
    });
    region.flush();
    
    expect(region).toBeDefined();
  });

  it('should show progress bar animation', () => {
    for (let i = 0; i <= 10; i++) {
      const bar = '█'.repeat(i) + '░'.repeat(10 - i);
      region.setLine(1, `Progress: [${bar}] ${i * 10}%`);
      region.flush();
      // Small delay to see animation
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
    
    expect(region).toBeDefined();
  });
});

