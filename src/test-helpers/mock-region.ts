/**
 * Simple mock TerminalRegion for unit tests
 * Just tracks setLine calls - no actual terminal emulation
 */
import type { TerminalRegion } from '../region.js';

export class MockTerminalRegion implements Partial<TerminalRegion> {
  private lines: Map<number, string> = new Map();
  public width: number = 80;
  public height: number = 24;

  constructor(width: number = 80, height: number = 24) {
    this.width = width;
    this.height = height;
  }

  getLine(lineNumber: number): string {
    return this.lines.get(lineNumber) || '';
  }

  setLine(lineNumber: number, content: string): void {
    this.lines.set(lineNumber, content);
  }

  clearLine(lineNumber: number): void {
    this.lines.delete(lineNumber);
  }

  clear(): void {
    this.lines.clear();
  }

  flush(): void {
    // No-op
  }

  setThrottle(_fps: number): void {
    // No-op
  }

  destroy(_clearFirst: boolean = false): void {
    // No-op
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }
}

