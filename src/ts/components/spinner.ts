import { TerminalRegion } from '../region.js';
import type { SpinnerOptions } from '../types.js';

const DEFAULT_SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Spinner {
  private region: TerminalRegion;
  private lineNumber: number; // 1-based
  private frameIndex: number = 0;
  private text: string = '';
  private interval?: NodeJS.Timeout;
  private isRunning: boolean = false;
  private frames: string[];
  private intervalMs: number;

  constructor(region: TerminalRegion, lineNumber: number, options: SpinnerOptions = {}) {
    this.region = region;
    this.lineNumber = lineNumber;
    this.frames = options.frames ?? DEFAULT_SPINNER_FRAMES;
    this.intervalMs = options.interval ?? 100;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    // Render immediately when starting
    this.render();
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.render();
    }, this.intervalMs);
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
    }
    // Clear the spinner line
    this.region.setLine(this.lineNumber, '');
  }

  setText(text: string): void {
    this.text = text;
    this.render();
  }

  private render(): void {
    const frame = this.frames[this.frameIndex];
    const line = `${frame} ${this.text}`;

    // Just update the line - Zig handles batching and rendering
    this.region.setLine(this.lineNumber, line);
    // Spinner updates frequently, so Zig's throttling will handle smooth animation
  }
}

