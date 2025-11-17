export { TerminalRegion } from './region';
export { getTerminalWidth, getTerminalHeight, isTTY, onResize } from './utils/terminal';
// Grid system
export { grid, style } from './api/grid';
export type { GridOptions } from './layout/grid';
export type { StyleOptions } from './components/style';
export { color } from './api/color';
// progressBar is exported below as a function
export { showPrompt } from './components/index';
export type {
  RegionOptions,
  LineContent,
  TextStyle,
  Color,
  ProgressBarOptions,
  SpinnerOptions,
} from './types';

import { TerminalRegion } from './region';
import { progressBar as progressBarGrid } from './components/progress-bar-grid';
import { Spinner } from './components/spinner';
import type { RegionOptions, ProgressBarOptions, SpinnerOptions } from './types';
import type { ProgressBarOptions as ProgressBarGridOptions } from './components/progress-bar-grid';

export function region(options?: RegionOptions): TerminalRegion {
  return new TerminalRegion(options);
}

// Keep createRegion as alias for backward compatibility
export const createRegion = region;

// Grid-based progress bar (returns Component)
export function progressBar(options: ProgressBarGridOptions) {
  return progressBarGrid(options);
}

// Keep createProgressBar as alias for backward compatibility
export const createProgressBar = progressBar;

export function spinner(
  region: TerminalRegion,
  lineNumber: number,
  options?: SpinnerOptions
): Spinner {
  return new Spinner(region, lineNumber, options);
}

// Keep createSpinner as alias for backward compatibility
export const createSpinner = spinner;

