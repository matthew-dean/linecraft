export { TerminalRegion, SectionReference } from './region';
export { getTerminalWidth, getTerminalHeight, isTTY, onResize } from './utils/terminal';
// Grid system
export { grid } from './layout/grid';
export { style } from './components/style';
export type { GridOptions } from './layout/grid';
export type { StyleOptions } from './components/style';
export { fill } from './components/fill';
export type { FillOptions } from './components/fill';
export { section, type SectionOptions } from './components/section';
export { createSpinner, type SpinnerOptions } from './components/spinner';
export { color } from './api/color';
// progressBar is exported below as a function
export { showPrompt } from './components/index';
export type {
  RegionOptions,
  LineContent,
  TextStyle,
  Color,
  ProgressBarOptions,
} from './types';

import { TerminalRegion } from './region';
import { progressBar as progressBarGrid } from './components/progress-bar-grid';
import type { RegionOptions, ProgressBarOptions } from './types';
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


