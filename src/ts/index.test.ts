import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRegion, createProgressBar, createSpinner } from './index.js';
import { TerminalRegion } from './region.js';
import { ProgressBar } from './components/progress-bar.js';
import { Spinner } from './components/spinner.js';

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
    const progressBar = createProgressBar(region, 1);
    expect(progressBar).toBeInstanceOf(ProgressBar);
  });

  it('should create a progress bar with options', () => {
    const progressBar = createProgressBar(region, 1, {
      label: 'Loading',
      width: 50,
    });
    expect(progressBar).toBeInstanceOf(ProgressBar);
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

