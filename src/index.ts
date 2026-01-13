export { TerminalRegion, SectionReference, ComponentReference } from './region.js';
export { getTerminalWidth, getTerminalHeight, isTTY, onResize } from './utils/terminal.js';
// Grid system
export { grid as Grid } from './layout/grid.js';
export { Styled } from './components/styled.js';
export type { GridOptions } from './layout/grid.js';
export type { StyleOptions } from './components/styled.js';
export { fill } from './components/fill.js';
export type { FillOptions } from './components/fill.js';
export { Section, type SectionOptions } from './components/section.js';
export { Spinner, type SpinnerOptions } from './components/spinner.js';
export { Segments, type SegmentsOptions, type Segment } from './components/segments.js';
export { CodeDebug, type CodeDebugOptions, type CodeDebugType } from './components/code-debug.js';
// progressBar is exported below as a function
export { prompt } from './utils/prompt.js';
export { autoColor, autoStyle, isAutoColor } from './utils/terminal-theme.js';
export type { AutoColor } from './utils/terminal-theme.js';
export type {
  RegionOptions,
  LineContent,
  TextStyle,
  Color,
  ProgressBarOptions,
} from './types.js';

import { TerminalRegion } from './region.js';
import { progressBar as progressBarGrid } from './components/progress-bar-grid.js';
import type { RegionOptions, ProgressBarOptions } from './types.js';
import type { ProgressBarOptions as ProgressBarGridOptions } from './components/progress-bar-grid.js';

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


