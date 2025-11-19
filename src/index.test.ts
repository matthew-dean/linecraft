import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRegion, createProgressBar, Spinner } from './index';
import { TerminalRegion } from './region';

describe('createRegion', () => {
  it('should create a TerminalRegion instance', () => {
    const region = createRegion({
      disableRendering: true,
    });
    expect(region).toBeInstanceOf(TerminalRegion);
    region.destroy();
  });

  it('should create a region with options', () => {
    const region = createRegion({ 
      width: 100, 
      height: 5,
      disableRendering: true,
    });
    expect(region.width).toBeGreaterThan(0);
    expect(region.height).toBe(5);
    region.destroy();
  });
});

describe('createProgressBar', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    region = createRegion({
      disableRendering: true,
    });
  });

  afterEach(() => {
    region.destroy();
  });

  it('should create a progress bar component', () => {
    const progressBar = createProgressBar({
      current: 0,
      total: 100,
    });
    // createProgressBar now returns a Component function
    expect(progressBar).toBeDefined();
    expect(typeof progressBar).toBe('function');
  });

  it('should create a progress bar with options', () => {
    const progressBar = createProgressBar({
      current: 50,
      total: 100,
      barColor: 'green',
      bracketColor: 'brightBlack',
      percentColor: 'yellow',
    });
    // createProgressBar now returns a Component function
    expect(progressBar).toBeDefined();
    expect(typeof progressBar).toBe('function');
  });
});

describe('spinner', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    region = createRegion({
      disableRendering: true,
    });
  });

  afterEach(() => {
    region.destroy();
  });

  it('should create a spinner with render, start, and stop methods', () => {
    const spinnerInstance = Spinner();
    expect(spinnerInstance).toBeDefined();
    expect(typeof spinnerInstance.render).toBe('function');
    expect(typeof spinnerInstance.start).toBe('function');
    expect(typeof spinnerInstance.stop).toBe('function');
    spinnerInstance.stop();
  });

  it('should create a spinner with options', () => {
    const spinnerInstance = Spinner({
      frames: ['-', '\\', '|', '/'],
      interval: 200,
      color: 'yellow',
    });
    expect(spinnerInstance).toBeDefined();
    expect(typeof spinnerInstance.render).toBe('function');
    expect(typeof spinnerInstance.start).toBe('function');
    expect(typeof spinnerInstance.stop).toBe('function');
    spinnerInstance.stop();
  });
});

