import { describe, it, expect, beforeEach } from 'vitest';
import { progressBar } from './progress-bar-grid.js';
import { TerminalRegion } from '../region.js';

describe('ProgressBar (Grid)', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    region = new TerminalRegion({ disableRendering: true, width: 80 });
  });

  it('should create a progress bar component', () => {
    const component = progressBar({
      current: 50,
      total: 100,
    });
    
    expect(typeof component).toBe('function');
    
    const result = component({
      availableWidth: 80,
      region: region,
      columnIndex: 0,
      rowIndex: 0,
    });
    
    expect(result).toBeTruthy();
    expect(typeof result === 'string').toBe(true);
  });

  it('should render progress bar with brackets and percent', () => {
    const component = progressBar({
      current: 50,
      total: 100,
    });
    
    const result = component({
      availableWidth: 80,
      region: region,
      columnIndex: 0,
      rowIndex: 0,
    });
    
    const plain = (result as string).replace(/\x1b\[[0-9;]*m/g, '');
    expect(plain).toContain('☾');
    expect(plain).toContain('☽');
    expect(plain).toContain('50.0%');
  });

  it('should calculate bar fill correctly', () => {
    const component = progressBar({
      current: 25,
      total: 100,
    });
    
    const result = component({
      availableWidth: 80,
      region: region,
      columnIndex: 0,
      rowIndex: 0,
    });
    
    const plain = (result as string).replace(/\x1b\[[0-9;]*m/g, '');
    expect(plain).toContain('25.0%');
  });

  it('should use custom colors', () => {
    const component = progressBar({
      current: 50,
      total: 100,
      barColor: 'green',
      bracketColor: 'brightBlack',
      percentColor: 'yellow',
    });
    
    const result = component({
      availableWidth: 80,
      region: region,
      columnIndex: 0,
      rowIndex: 0,
    });
    
    expect(result).toContain('\x1b[32m'); // green
    expect(result).toContain('\x1b[33m'); // yellow
  });

  it('should handle 0% progress', () => {
    const component = progressBar({
      current: 0,
      total: 100,
    });
    
    const result = component({
      availableWidth: 80,
      region: region,
      columnIndex: 0,
      rowIndex: 0,
    });
    
    const plain = (result as string).replace(/\x1b\[[0-9;]*m/g, '');
    expect(plain).toContain('0.0%');
  });

  it('should handle 100% progress', () => {
    const component = progressBar({
      current: 100,
      total: 100,
    });
    
    const result = component({
      availableWidth: 80,
      region: region,
      columnIndex: 0,
      rowIndex: 0,
    });
    
    const plain = (result as string).replace(/\x1b\[[0-9;]*m/g, '');
    // Check for 100.0% or just 100% (depending on formatting)
    expect(plain).toMatch(/100\.?0?%/);
  });
});

