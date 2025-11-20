export { TerminalRegion, SectionReference } from './region';
export { getTerminalWidth, getTerminalHeight, isTTY, onResize } from './utils/terminal';
// Grid system
export { grid as Grid } from './layout/grid';
export { Styled } from './components/styled';
export type { GridOptions } from './layout/grid';
export type { StyleOptions } from './components/styled';
export { fill } from './components/fill';
export type { FillOptions } from './components/fill';
export { Section, type SectionOptions } from './components/section';
export { Spinner, type SpinnerOptions } from './components/spinner';
export { Segments, type SegmentsOptions, type Segment } from './components/segments';
// progressBar is exported below as a function
export { prompt } from './utils/prompt';
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

export function Region(options?: RegionOptions): TerminalRegion {
  return new TerminalRegion(options);
}

// Keep region and createRegion as aliases for backward compatibility
export const region = Region;
export const createRegion = Region;

// Grid-based progress bar (returns Component)
export function progressBar(options: ProgressBarGridOptions) {
  return progressBarGrid(options);
}

// Keep createProgressBar as alias for backward compatibility
export const createProgressBar = progressBar;


