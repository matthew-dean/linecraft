import type { TerminalRegion } from '../region.js';
import type { Renderable } from './renderable.js';
import { flex, col, resolveFlexTree } from '../api/flex.js';
import { createCol } from './col.js';
import { color } from '../api/color.js';
import type { Color } from '../types.js';

export interface ProgressBarComponentOptions {
  current: number;
  total: number;
  label?: string;
  width?: number; // Bar width (not total width)
  labelColor?: Color;
  barColor?: Color;
  bracketColor?: Color;
  percentColor?: Color;
  completeChar?: string;
  incompleteChar?: string;
  brackets?: [string, string];
  flex?: number; // Flex grow ratio (alias for flexGrow)
  flexGrow?: number;
  flexShrink?: number;
  minWidth?: number;
  maxWidth?: number;
}

/**
 * Create a progress bar component - just composes flex/col components
 */
export function createProgressBar(
  region: TerminalRegion,
  options: ProgressBarComponentOptions
): Renderable {
  const percent = Math.min(100, Math.max(0, (options.current / options.total) * 100));
  const barWidth = options.width ?? 40;
  const filled = Math.floor((percent / 100) * barWidth);
  const empty = barWidth - filled;
  
  const completeChar = options.completeChar ?? '━';
  const incompleteChar = options.incompleteChar ?? '─';
  const leftBracket = options.brackets?.[0] ?? '\u2282';
  const rightBracket = options.brackets?.[1] ?? '\u2283';
  
  const bracketColor = options.bracketColor ?? 'brightBlack';
  
  const children = [];
  
  if (options.label) {
    const labelColor = options.labelColor ?? 'white';
    children.push(col({ width: options.label.length + 1 }, color(labelColor, options.label)));
  }
  
  children.push(col({ width: 1 }, color(bracketColor, leftBracket)));
  
  // Bar column - calculates bar width dynamically based on available space
  const barCol: Renderable = {
    flexGrow: 1,
    flexShrink: 1,
    getPreferredWidth: () => barWidth + 2,
    getMinWidth: () => 0,
    getMaxWidth: () => Infinity,
    getHeight: () => 1,
    render: (x, y, width) => {
      // Calculate bar based on actual available width (minus spaces)
      const availableBarWidth = Math.max(0, width - 2);
      const actualFilled = Math.floor((percent / 100) * availableBarWidth);
      const actualEmpty = availableBarWidth - actualFilled;
      const actualFilledBar = completeChar.repeat(actualFilled);
      const actualEmptyBar = incompleteChar.repeat(actualEmpty);
      const barContent = ' ' + (options.barColor ? color(options.barColor, actualFilledBar) : actualFilledBar) + color('brightBlack', actualEmptyBar) + ' ';
      createCol(region, barContent, { overflow: 'none' }).render(x, y, width);
    },
  };
  children.push(barCol);
  
  children.push(col({ width: 1 }, color(bracketColor, rightBracket)));
  // Percentage column needs fixed width to prevent truncation when terminal is narrow
  children.push(col({ width: 6 }, color(options.percentColor ?? 'brightBlack', percent.toFixed(1) + '%')));
  
  const flexComponent = resolveFlexTree(region, flex({ gap: 0 }, ...children));
  
  // Default to flex: 1 so progress bar is flexible by default
  const flexGrow = options.flex ?? options.flexGrow ?? 1;
  
  return {
    flexGrow,
    flexShrink: options.flexShrink ?? 1,
    getPreferredWidth: () => flexComponent.getPreferredWidth(),
    getMinWidth: () => flexComponent.getMinWidth(), // Always use flex component's minWidth (no external constraint)
    getMaxWidth: () => options.maxWidth ?? flexComponent.getMaxWidth(),
    getHeight: () => flexComponent.getHeight(),
    render: (x, y, width) => flexComponent.render(x, y, width),
  };
}

// Keep old ProgressBar class for backward compatibility (used in tests and createProgressBar)
export class ProgressBar {
  private region: TerminalRegion;
  private lineNumber: number; // 1-based
  private current: number = 0;
  private total: number = 100;
  private label: string;
  private width: number;
  private completeChar: string;
  private incompleteChar: string;
  private brackets: [string, string];

  constructor(region: TerminalRegion, lineNumber: number, options: any = {}) {
    this.region = region;
    this.lineNumber = lineNumber;
    this.label = options.label || '';
    this.width = options.width ?? 40;
    this.completeChar = options.style?.complete ?? '━';
    this.incompleteChar = options.style?.incomplete ?? '─';
    this.brackets = options.style?.brackets ?? ['\u2282', '\u2283']; // ⊂ ⊃
  }

  update(current: number, total: number): void {
    this.current = current;
    this.total = total;
    this.render();
  }

  setLabel(label: string): void {
    this.label = label;
    this.render();
  }

  private render(): void {
    const percentage = Math.min(100, Math.max(0, (this.current / this.total) * 100));
    const filled = Math.floor((percentage / 100) * this.width);
    const empty = this.width - filled;

    const bar = this.completeChar.repeat(filled) + this.incompleteChar.repeat(empty);
    const text = `${this.label} ${this.brackets[0]} ${bar} ${this.brackets[1]} ${percentage.toFixed(1)}%`;

    this.region.setLine(this.lineNumber, text);
  }

  finish(): void {
    this.update(this.total, this.total);
  }
}

