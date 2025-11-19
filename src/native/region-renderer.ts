import * as fs from 'fs';
import * as path from 'path';
import { diffFrames } from './diff';
import * as ansi from './ansi';
import { RenderBuffer } from './buffer';
import { Throttle } from './throttle';
import { getTerminalHeight as getDefaultTerminalHeight } from '../utils/terminal';

export interface RegionRendererOptions {
  stdout?: NodeJS.WriteStream;
  disableRendering?: boolean;
  onKeepAlive?: () => void;
  debugLog?: string;
}

export class RegionRenderer {
  public width: number;
  public height: number;
  public pendingFrame: string[];
  public previousFrame: string[];
  public disableRendering: boolean;
  public lastRenderedHeight: number = 0;

  private readonly stdout: NodeJS.WriteStream;
  private readonly throttle: Throttle;
  private readonly renderBuffer: RenderBuffer;
  private readonly permanentlyDisabled: boolean;
  private readonly onKeepAlive?: () => void;
  private viewportWidth: number;
  private viewportHeight: number;
  private previousViewportFrame: string[];
  private effectiveWidth: number;
  private autoWrapDisabled = false;
  private inAlternateScreen = false;
  private isRendering = false;
  private renderTimer: NodeJS.Timeout | null = null;
  private resizeCleanup?: () => void;
  private destroyed = false;
  private debugLogPath?: string;
  private debugLogCleared = false;
  private cursorVisible = false;

  private static exitHandlerSetup = false;
  private static activeRegions: Set<RegionRenderer> = new Set();

  constructor(options: RegionRendererOptions = {}) {
    this.stdout = options.stdout ?? process.stdout;
    this.onKeepAlive = options.onKeepAlive;
    this.viewportWidth = this.readViewportWidth();
    this.viewportHeight = this.readViewportHeight();
    this.width = this.viewportWidth;
    this.height = 1;
    this.pendingFrame = Array(this.height).fill('');
    this.previousFrame = Array(this.height).fill('');
    this.previousViewportFrame = Array(Math.max(1, this.viewportHeight)).fill('');
    this.throttle = new Throttle(30);
    this.renderBuffer = new RenderBuffer(this.stdout);
    this.permanentlyDisabled = options.disableRendering ?? false;
    this.disableRendering = this.permanentlyDisabled;
    this.debugLogPath = this.resolveDebugLogPath(options.debugLog);
    this.effectiveWidth = this.viewportWidth;

    if (!this.permanentlyDisabled) {
      this.initializeTerminalState();
      this.setupResizeHandler();
      RegionRenderer.registerRegion(this);
    }
  }

  getWidth(): number {
    this.width = this.viewportWidth;
    this.effectiveWidth = this.viewportWidth;
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  async getStartRow(): Promise<number | null> {
    return 1;
  }

  setThrottleFps(fps: number): void {
    this.throttle.setFps(fps);
  }

  setLine(lineNumber: number, content: string): void {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }
    const index = lineNumber - 1;
    this.ensureFrameSize(index + 1);
    this.pendingFrame[index] = content;
    if (lineNumber > this.height) {
      this.height = lineNumber;
    }
    this.scheduleRender();
  }

  updateLines(updates: Array<{ lineNumber: number; content: string }>): void {
    if (updates.length === 0) {
          return;
        }
    for (const { lineNumber, content } of updates) {
      if (lineNumber < 1) {
        throw new Error('Line numbers start at 1');
      }
      const index = lineNumber - 1;
      this.ensureFrameSize(index + 1);
      this.pendingFrame[index] = content;
      if (lineNumber > this.height) {
        this.height = lineNumber;
      }
    }
    this.scheduleRender();
  }

  set(content: string): void {
    const lines = content.split('\n');
    this.pendingFrame = [...lines];
    this.previousFrame = new Array(lines.length).fill('');
    this.height = lines.length;
    this.scheduleRender();
  }

  getLine(lineNumber: number): string {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }
    return this.pendingFrame[lineNumber - 1] ?? '';
  }

  clearLine(lineNumber: number): void {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }
    const index = lineNumber - 1;
    if (index >= this.pendingFrame.length) {
      return;
    }
    this.pendingFrame[index] = '';
    this.scheduleRender();
  }

  clear(): void {
    for (let i = 0; i < this.pendingFrame.length; i++) {
      this.pendingFrame[i] = '';
    }
    this.scheduleRender();
  }

  async flush(): Promise<void> {
    await this.renderNow();
  }

  expandTo(newHeight: number): void {
    if (newHeight <= this.height) {
      return;
    }
    this.ensureFrameSize(newHeight);
    this.height = newHeight;
  }

  setHeight(height: number): void {
    this.height = height;
  }

  shrinkFrame(startIndex: number, count: number): void {
    this.pendingFrame.splice(startIndex, count);
    if (this.previousFrame.length >= startIndex + count) {
      this.previousFrame.splice(startIndex, count);
    }
    // Clear previousViewportFrame so next render recalculates from scratch
    // This ensures deleted lines are properly handled
    this.previousViewportFrame = [];
  }

  async destroy(clearFirst: boolean = false): Promise<void> {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    RegionRenderer.activeRegions.delete(this);
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    if (this.resizeCleanup) {
      this.resizeCleanup();
      this.resizeCleanup = undefined;
    }
      if (this.permanentlyDisabled) {
        return;
      }
    if (!clearFirst) {
      await this.renderNow();
    }
    this.leaveAlternateScreen(clearFirst);
    this.pendingFrame = [];
    this.previousFrame = [];
    this.previousViewportFrame = [];
  }

  public logToFile(message: string): void {
    if (!this.debugLogPath) {
      return;
    }
    try {
      if (!this.debugLogCleared) {
        fs.writeFileSync(
          this.debugLogPath,
          '# Linecraft Debug Log\n# Debug output from RegionRenderer\n\n',
          'utf8'
        );
        this.debugLogCleared = true;
      }
      const timestamp = new Date().toISOString();
      fs.appendFileSync(this.debugLogPath, `[${timestamp}] ${message}\n`, 'utf8');
    } catch {
      // ignore logging failures
    }
  }

  private static registerRegion(region: RegionRenderer): void {
    RegionRenderer.activeRegions.add(region);
    RegionRenderer.setupExitHandler();
  }

  private static setupExitHandler(): void {
    if (RegionRenderer.exitHandlerSetup) {
      return;
    }
    RegionRenderer.exitHandlerSetup = true;
    const cleanup = (): void => {
      for (const region of RegionRenderer.activeRegions) {
        region.destroy(true).catch(() => {});
      }
      RegionRenderer.activeRegions.clear();
    };
    process.once('exit', cleanup);
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  }

  private ensureFrameSize(size: number): void {
    while (this.pendingFrame.length < size) {
      this.pendingFrame.push('');
    }
    while (this.previousFrame.length < size) {
      this.previousFrame.push('');
    }
  }

  private scheduleRender(): void {
    if (this.disableRendering || this.permanentlyDisabled || this.destroyed) {
      return;
    }
    if (this.renderTimer) {
      return;
    }
    if (this.throttle.shouldRender()) {
      void this.renderNow();
      return;
    }
    const delay = Math.max(0, this.throttle.timeUntilNextFrame());
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      void this.renderNow();
    }, delay);
  }

  private async renderNow(): Promise<void> {
    if (this.destroyed || this.permanentlyDisabled) {
      return;
    }
    if (this.disableRendering) {
      this.copyPendingToPrevious();
      return;
    }
    if (this.isRendering) {
      return;
    }
    this.isRendering = true;
    this.renderTimer = null;
    try {
      this.ensureTerminalState();
      const frame = this.buildViewportFrame();
      this.applyDiff(frame);
      this.previousViewportFrame = [...frame];
      this.copyPendingToPrevious();
      this.lastRenderedHeight = this.height;
    } finally {
      this.isRendering = false;
    }
  }

  private copyPendingToPrevious(): void {
    const normalized = this.getEffectiveFrame();
    this.previousFrame = [...normalized];
  }

  private buildViewportFrame(): string[] {
    const viewportHeight = Math.max(1, this.viewportHeight);
    const normalized = this.getEffectiveFrame();
    const visibleLines = Math.min(viewportHeight, normalized.length);
    const frame = new Array<string>(viewportHeight).fill('');

    if (visibleLines === 0) {
      return frame;
    }

    const startIndex = normalized.length > viewportHeight
      ? normalized.length - viewportHeight
      : 0;

    for (let i = 0; i < visibleLines; i++) {
      frame[i] = normalized[startIndex + i];
    }

    return frame;
  }

  private mapLineToViewportRow(lineNumber: number): number | null {
    const viewportHeight = Math.max(1, this.viewportHeight);
    const visibleStart = Math.max(1, this.height - viewportHeight + 1);
    const visibleEnd = visibleStart + viewportHeight - 1;

    if (lineNumber < visibleStart || lineNumber > visibleEnd) {
      return null;
    }

    return lineNumber - visibleStart + 1;
  }

  hideCursor(): void {
    if (this.permanentlyDisabled) {
      return;
    }
    this.stdout.write(ansi.HIDE_CURSOR);
    this.cursorVisible = false;
  }

  showCursorAt(lineNumber: number, column: number): void {
    if (this.permanentlyDisabled) {
      return;
    }
    this.ensureTerminalState();
    const row = this.mapLineToViewportRow(lineNumber);
    if (row === null) {
      return;
    }
    const col = Math.max(1, Math.min(column, this.viewportWidth));
    this.stdout.write(ansi.moveCursorTo(col, row));
    this.stdout.write(ansi.SHOW_CURSOR);
    this.cursorVisible = true;
  }

  private getEffectiveFrame(): string[] {
    const target = Math.max(0, this.height);
    const frame = this.pendingFrame.slice(0, target);
    while (frame.length < target) {
      frame.push('');
    }
    return frame;
  }

  private applyDiff(nextFrame: string[]): void {
    const ops = diffFrames(this.previousViewportFrame, nextFrame);
    let wrote = false;
    for (const op of ops) {
      if (op.type === 'no_change') {
        continue;
      }
      if (!wrote) {
        this.renderBuffer.write(ansi.HIDE_CURSOR);
        wrote = true;
      }
      const row = op.line + 1;
      let lineContent = '';
      if (op.type === 'delete_line') {
        lineContent = '';
        } else {
        lineContent = nextFrame[op.line] ?? op.content ?? '';
      }
      this.renderBuffer.write(ansi.moveCursorTo(1, row));
      this.renderBuffer.write(ansi.CLEAR_LINE);
      if (lineContent.length > 0) {
        this.renderBuffer.write(this.truncateContent(lineContent, this.effectiveWidth));
        this.renderBuffer.write(ansi.RESET);
      }
    }
    if (wrote) {
      this.renderBuffer.flush();
      this.hideCursor();
    }
  }

  private truncateContent(content: string, maxWidth: number): string {
    if (maxWidth <= 0) {
      return '';
    }
    const plain = this.stripAnsi(content);
    if (plain.length <= maxWidth) {
      return content;
    }
    let visual = 0;
    let idx = 0;
    while (idx < content.length && visual < maxWidth) {
      if (content[idx] === '\x1b') {
        let end = idx + 1;
        while (end < content.length && content[end] !== 'm') {
          end++;
        }
        if (end < content.length) {
          end++;
        }
        idx = end;
          } else {
        idx++;
        visual++;
      }
    }
    return content.slice(0, idx);
  }

  private stripAnsi(value: string): string {
    return value.replace(/\x1b\[[0-9;]*m/g, '');
  }

  private initializeTerminalState(): void {
    if (this.inAlternateScreen) {
      return;
    }
    this.stdout.write(ansi.ENTER_ALTERNATE_SCREEN);
    this.stdout.write(ansi.DISABLE_AUTO_WRAP);
    this.stdout.write(ansi.ERASE_SCREEN);
    this.stdout.write(ansi.moveCursorTo(1, 1));
    this.autoWrapDisabled = true;
    this.inAlternateScreen = true;
  }

  private ensureTerminalState(): void {
    if (!this.inAlternateScreen) {
      this.initializeTerminalState();
    }
    if (!this.autoWrapDisabled) {
      this.stdout.write(ansi.DISABLE_AUTO_WRAP);
      this.autoWrapDisabled = true;
    }
  }

  private leaveAlternateScreen(clearFirst: boolean): void {
    if (!this.inAlternateScreen) {
      return;
    }
    this.stdout.write(ansi.SHOW_CURSOR);
    if (this.autoWrapDisabled) {
      this.stdout.write(ansi.ENABLE_AUTO_WRAP);
      this.autoWrapDisabled = false;
    }
    this.stdout.write(ansi.EXIT_ALTERNATE_SCREEN);
    this.inAlternateScreen = false;
    if (!clearFirst) {
      const finalLines = this.getEffectiveFrame();
      // Remove trailing empty lines - don't add extra blank lines to original screen
      let lastNonEmpty = finalLines.length;
      while (lastNonEmpty > 0 && finalLines[lastNonEmpty - 1].trim() === '') {
        lastNonEmpty--;
      }
      const trimmedLines = finalLines.slice(0, lastNonEmpty);
      if (trimmedLines.length > 0) {
        const output = trimmedLines.join('\n');
        this.stdout.write(`${output}\n`);
      }
    }
  }

  private setupResizeHandler(): void {
    if (!this.stdout.isTTY || typeof this.stdout.on !== 'function') {
      return;
    }
    const handler = () => {
      this.updateViewportMetrics();
      this.previousViewportFrame = Array(Math.max(1, this.viewportHeight)).fill('');
      this.lastRenderedHeight = 0;
      if (this.onKeepAlive) {
        this.onKeepAlive();
      }
      this.scheduleRender();
    };
    this.stdout.on('resize', handler);
    this.resizeCleanup = () => {
      if (typeof this.stdout.off === 'function') {
        this.stdout.off('resize', handler);
      } else if (typeof this.stdout.removeListener === 'function') {
        this.stdout.removeListener('resize', handler);
      }
    };
  }

  private updateViewportMetrics(): void {
    const width = this.readViewportWidth();
    const height = this.readViewportHeight();
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.width = this.viewportWidth;
    this.effectiveWidth = this.viewportWidth;
  }

  private readViewportWidth(): number {
    if (this.stdout.isTTY && typeof this.stdout.columns === 'number' && this.stdout.columns > 0) {
      return this.stdout.columns;
    }
    if (process.stdout.isTTY && typeof process.stdout.columns === 'number' && process.stdout.columns > 0) {
      return process.stdout.columns;
    }
    if (process.env.COLUMNS) {
      const parsed = parseInt(process.env.COLUMNS, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return 80;
  }

  private readViewportHeight(): number {
    if (this.stdout.isTTY && typeof this.stdout.rows === 'number' && this.stdout.rows > 0) {
      return this.stdout.rows;
    }
    if (process.stdout.isTTY && typeof process.stdout.rows === 'number' && process.stdout.rows > 0) {
      return process.stdout.rows;
    }
    return getDefaultTerminalHeight();
  }

  private resolveDebugLogPath(debugLog?: string): string | undefined {
    if (!debugLog) {
      return undefined;
    }
    return path.isAbsolute(debugLog) ? debugLog : path.join(process.cwd(), debugLog);
  }
}
