export { TerminalRegion } from './region.js';
export { ProgressBar } from './components/progress-bar.js';
export { Spinner } from './components/spinner.js';
export { getTerminalWidth, getTerminalHeight, isTTY, onResize } from './utils/terminal.js';
export { flex, col, component } from './api/flex.js';
export type { FlexChild } from './api/flex.js';
export { color } from './api/color.js';
export { progressBar, spinner } from './components/index.js';
export type {
  RegionOptions,
  LineContent,
  TextStyle,
  Color,
  ProgressBarOptions,
  SpinnerOptions,
} from './types.js';

import { TerminalRegion } from './region.js';
import { ProgressBar } from './components/progress-bar.js';
import { Spinner } from './components/spinner.js';
import type { RegionOptions, ProgressBarOptions, SpinnerOptions } from './types.js';

export function createRegion(options?: RegionOptions): TerminalRegion {
  return new TerminalRegion(options);
}

export function createProgressBar(
  region: TerminalRegion,
  lineNumber: number,
  options?: ProgressBarOptions
): ProgressBar {
  return new ProgressBar(region, lineNumber, options);
}

export function createSpinner(
  region: TerminalRegion,
  lineNumber: number,
  options?: SpinnerOptions
): Spinner {
  return new Spinner(region, lineNumber, options);
}

