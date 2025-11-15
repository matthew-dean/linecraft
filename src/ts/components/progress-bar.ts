import { TerminalRegion } from '../region.js';
import type { ProgressBarOptions } from '../types.js';

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

  constructor(region: TerminalRegion, lineNumber: number, options: ProgressBarOptions = {}) {
    this.region = region;
    this.lineNumber = lineNumber;
    this.label = options.label || '';
    this.width = options.width ?? 40;
    // Use better Unicode characters: ━ (thick line) for filled, ─ (thin line) for empty, ☽ ☾ for brackets (facing each other)
    this.completeChar = options.style?.complete ?? '━';
    this.incompleteChar = options.style?.incomplete ?? '─';
    this.brackets = options.style?.brackets ?? ['\u263E', '\u263D']; // ☾ ☽ (facing each other)
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
    // Add padding: space before and after the bar
    const text = `${this.label} ${this.brackets[0]} ${bar} ${this.brackets[1]} ${percentage.toFixed(1)}%`;

    // Just update the line - Zig handles batching and rendering
    this.region.setLine(this.lineNumber, text);
    // Optional: call flush() if you need immediate rendering
  }

  finish(): void {
    this.update(this.total, this.total);
  }
}

