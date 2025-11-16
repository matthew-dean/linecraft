import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRegion, createProgressBar, createSpinner } from './index';
import { TerminalRegion } from './region';
import { ProgressBar } from './components/progress-bar';
import { Spinner } from './components/spinner';

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
    expect(region.width).toBe(100);
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

  it('should create a ProgressBar instance', () => {
    const progressBar = createProgressBar(region, {
      current: 0,
      total: 100,
    });
    // createProgressBar now returns a Renderable, not a ProgressBar instance
    expect(progressBar).toBeDefined();
    expect(progressBar).toHaveProperty('render');
    expect(progressBar).toHaveProperty('getHeight');
  });

  it('should create a progress bar with options', () => {
    const progressBar = createProgressBar(region, {
      current: 50,
      total: 100,
      label: 'Loading',
      width: 50,
    });
    // createProgressBar now returns a Renderable, not a ProgressBar instance
    expect(progressBar).toBeDefined();
    expect(progressBar).toHaveProperty('render');
    expect(progressBar).toHaveProperty('getHeight');
  });
});

describe('createSpinner', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    region = createRegion({
      disableRendering: true,
    });
  });

  afterEach(() => {
    region.destroy();
  });

  it('should create a Spinner instance', () => {
    const spinner = createSpinner(region, 1);
    expect(spinner).toBeInstanceOf(Spinner);
    spinner.stop();
  });

  it('should create a spinner with options', () => {
    const spinner = createSpinner(region, 1, {
      frames: ['-', '\\', '|', '/'],
      interval: 200,
    });
    expect(spinner).toBeInstanceOf(Spinner);
    spinner.stop();
  });
});

