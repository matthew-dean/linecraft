export { TerminalRegion } from './region';
export { getTerminalWidth, getTerminalHeight, isTTY, onResize } from './utils/terminal';
// Grid system (new)
export { grid, style } from './api/grid';
export type { GridOptions } from './layout/grid';
export type { StyleOptions } from './components/style';
// Flex system (legacy - will be removed)
export { flex, col, component } from './api/flex';
export type { FlexChild } from './api/flex';
export { divider } from './api/divider';
export { color } from './api/color';
// progressBar is exported below as a function
export { createJustifyBetween as justifyBetween } from './layout/justify-between';
export { createResponsive as responsive } from './layout/responsive';
export { createBadge as badge, showPrompt, createRoundedBox as roundedBox } from './components/index';
export type {
  RegionOptions,
  LineContent,
  TextStyle,
  Color,
  ProgressBarOptions,
  SpinnerOptions,
} from './types';

import { TerminalRegion } from './region';
import { createProgressBar as createProgressBarComponent } from './components/progress-bar';
import { progressBar as progressBarGrid } from './components/progress-bar-grid';
import { Spinner } from './components/spinner';
import type { RegionOptions, ProgressBarOptions, SpinnerOptions } from './types';
import type { ProgressBarComponentOptions } from './components/progress-bar';
import type { ProgressBarOptions as ProgressBarGridOptions } from './components/progress-bar-grid';

export function region(options?: RegionOptions): TerminalRegion {
  return new TerminalRegion(options);
}

// Keep createRegion as alias for backward compatibility
export const createRegion = region;

// New grid-based progress bar (returns Component)
export function progressBar(options: ProgressBarGridOptions) {
  return progressBarGrid(options);
}

// Legacy flex-based progress bar (returns Renderable)
export function progressBarLegacy(
  region: TerminalRegion,
  options: ProgressBarComponentOptions
) {
  return createProgressBarComponent(region, options);
}

// Keep createProgressBar as alias for backward compatibility (uses new grid version)
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

