import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRegion, createProgressBar, createSpinner } from './index';
import { TerminalRegion } from './region';
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

