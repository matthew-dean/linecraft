import * as fs from 'fs';
import * as path from 'path';
import { diffFrames } from './diff.js';
import * as ansi from './ansi.js';
import { RenderBuffer } from './buffer.js';
import { Throttle } from './throttle.js';
import { getTerminalHeight as getDefaultTerminalHeight } from '../utils/terminal.js';
import { truncateToWidth } from '../utils/text.js';

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
    
    // Log if we're overwriting non-empty content (potential duplication)
    if (this.pendingFrame[index] && this.pendingFrame[index].trim().length > 0 && content.trim().length > 0) {
      const oldContent = this.pendingFrame[index].substring(0, 40);
      const newContent = content.substring(0, 40);
      if (oldContent !== newContent) {
        this.logToFile(`[setLine] WARNING: Overwriting line ${lineNumber} - old: "${oldContent}", new: "${newContent}"`);
    } else {
        this.logToFile(`[setLine] Writing same content to line ${lineNumber}: "${newContent}"`);
      }
    }
    
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

  ensureFrameSize(size: number): void {
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
      
      // CRITICAL: If previousViewportFrame is empty (e.g., on resize), do a full redraw
      // On resize, viewport dimensions change and content may wrap differently,
      // causing the viewport to show different logical lines. Since we control all rendering,
      // we can simply clear and redraw the entire viewport fresh.
      if (this.previousViewportFrame.length === 0) {
        const viewportHeight = Math.max(1, this.viewportHeight);
        const normalized = this.getEffectiveFrame();
        this.logToFile(`[renderNow] FULL REDRAW - viewportHeight: ${viewportHeight}, frame.length: ${frame.length}, normalized.length: ${normalized.length}, height: ${this.height}`);
        this.logToFile(`[renderNow] Frame content (first 5): ${frame.slice(0, 5).map((l, i) => `[${i}]: "${l.substring(0, 50)}"`).join(', ')}`);
        this.logToFile(`[renderNow] Frame content (last 5): ${frame.slice(-5).map((l, i) => `[${frame.length - 5 + i}]: "${l.substring(0, 50)}"`).join(', ')}`);
        
        // Full redraw: clear and write all viewport lines fresh
        // Instead of ERASE_SCREEN (which might have issues during resize),
        // we clear each line individually for more reliable behavior
        this.renderBuffer.write(ansi.HIDE_CURSOR);
        
        // Clear all viewport lines first (from bottom to top to avoid cursor issues)
        this.logToFile(`[renderNow] Clearing ${viewportHeight} lines (from bottom to top)`);
        for (let i = viewportHeight - 1; i >= 0; i--) {
          const row = i + 1;
          this.renderBuffer.write(ansi.moveCursorTo(1, row));
          this.renderBuffer.write(ansi.CLEAR_LINE);
        }
        
        // Now write all lines in the frame (frame.length should equal viewportHeight)
        const linesToWrite = Math.min(frame.length, viewportHeight);
        this.logToFile(`[renderNow] Writing ${linesToWrite} lines to viewport`);
        for (let i = 0; i < linesToWrite; i++) {
          const row = i + 1;
          const lineContent = frame[i] ?? '';
          this.renderBuffer.write(ansi.moveCursorTo(1, row));
          if (lineContent.length > 0) {
            this.renderBuffer.write(this.truncateContent(lineContent, this.effectiveWidth));
            this.renderBuffer.write(ansi.RESET);
          }
          // Log first few and last few lines being written
          if (i < 3 || i >= linesToWrite - 3) {
            this.logToFile(`[renderNow] Writing row ${row}: "${lineContent.substring(0, 60)}"`);
          }
        }
        
        // CRITICAL: Clear any lines beyond what we wrote (if viewport is larger than frame)
        // This ensures we don't have leftover content from previous renders
        if (linesToWrite < viewportHeight) {
          this.logToFile(`[renderNow] Clearing ${viewportHeight - linesToWrite} extra lines (${linesToWrite} to ${viewportHeight - 1})`);
          for (let i = linesToWrite; i < viewportHeight; i++) {
            const row = i + 1;
            this.renderBuffer.write(ansi.moveCursorTo(1, row));
            this.renderBuffer.write(ansi.CLEAR_LINE);
          }
        }
        
          this.renderBuffer.flush();
        this.hideCursor();
        } else {
        // Normal diff-based rendering (for incremental updates)
        this.applyDiff(frame);
      }
      
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
      this.logToFile(`[buildViewportFrame] No visible lines - normalized.length: ${normalized.length}, viewportHeight: ${viewportHeight}`);
      return frame;
        }

    const startIndex = normalized.length > viewportHeight
      ? normalized.length - viewportHeight
      : 0;

    this.logToFile(`[buildViewportFrame] normalized.length: ${normalized.length}, viewportHeight: ${viewportHeight}, startIndex: ${startIndex}, visibleLines: ${visibleLines}`);

    for (let i = 0; i < visibleLines; i++) {
      frame[i] = normalized[startIndex + i];
    }
    
    // Log what we're putting in the frame
    if (startIndex > 0 || visibleLines < normalized.length) {
      this.logToFile(`[buildViewportFrame] Frame shows lines ${startIndex + 1} to ${startIndex + visibleLines} of ${normalized.length} total lines`);
      this.logToFile(`[buildViewportFrame] First frame line: "${frame[0]?.substring(0, 50)}"`);
      this.logToFile(`[buildViewportFrame] Last frame line: "${frame[visibleLines - 1]?.substring(0, 50)}"`);
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
    // Log if frame seems corrupted (has content but in wrong order)
    if (frame.length > 0 && frame.some((line, i) => line.length > 0)) {
      const nonEmptyLines = frame.map((line, i) => ({ index: i, content: line.substring(0, 50) })).filter(l => l.content.length > 0);
      if (nonEmptyLines.length > 1) {
        // Check if first non-empty line looks like it should be later (e.g., contains "Press SPACEBAR" or is a border)
        const firstNonEmpty = nonEmptyLines[0];
        if (firstNonEmpty.content.includes('Press SPACEBAR') || firstNonEmpty.content.includes('╰') || firstNonEmpty.content.includes('│')) {
          this.logToFile(`[getEffectiveFrame] WARNING: Frame might be corrupted - first non-empty line at index ${firstNonEmpty.index}: "${firstNonEmpty.content}"`);
        }
      }
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
      
      if (op.type === 'delete_line') {
        // Delete line: clear it completely using CLEAR_LINE
        this.renderBuffer.write(ansi.moveCursorTo(1, row));
        this.renderBuffer.write(ansi.CLEAR_LINE);
        // Note: After delete, all lines below shift up, so they'll be redrawn by subsequent ops
        } else {
        // Full line update: clear and redraw
        const lineContent = nextFrame[op.line] ?? op.content ?? '';
        this.renderBuffer.write(ansi.moveCursorTo(1, row));
        this.renderBuffer.write(ansi.CLEAR_LINE);
        if (lineContent.length > 0) {
          this.renderBuffer.write(this.truncateContent(lineContent, this.effectiveWidth));
          this.renderBuffer.write(ansi.RESET);
        }
      }
    }
    if (wrote) {
          this.renderBuffer.flush();
      this.hideCursor();
    }
  }

  private truncateContent(content: string, maxWidth: number): string {
    return truncateToWidth(content, maxWidth);
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
      const oldViewportHeight = this.viewportHeight;
      const oldViewportWidth = this.viewportWidth;
      this.updateViewportMetrics();
      const newViewportHeight = this.viewportHeight;
      const newViewportWidth = this.viewportWidth;
      
      this.logToFile(`[resize] ========================================`);
      this.logToFile(`[resize] OLD: height=${oldViewportHeight}, width=${oldViewportWidth}`);
      this.logToFile(`[resize] NEW: height=${newViewportHeight}, width=${newViewportWidth}`);
      this.logToFile(`[resize] Content height: ${this.height}, pendingFrame.length: ${this.pendingFrame.length}`);
      this.logToFile(`[resize] previousViewportFrame.length: ${this.previousViewportFrame.length}`);
      if (this.previousViewportFrame.length > 0) {
        this.logToFile(`[resize] Previous frame (first 3): ${this.previousViewportFrame.slice(0, 3).map((l, i) => `[${i}]: "${l.substring(0, 40)}"`).join(', ')}`);
        this.logToFile(`[resize] Previous frame (last 3): ${this.previousViewportFrame.slice(-3).map((l, i) => `[${this.previousViewportFrame.length - 3 + i}]: "${l.substring(0, 40)}"`).join(', ')}`);
      }
      
      // CRITICAL: On resize, clear the screen and do a full redraw
      // This bypasses the diff algorithm which can get confused when:
      // 1. Viewport dimensions change
      // 2. Content wraps differently, changing logical line positions
      // 3. The viewport frame represents different logical lines
      
      // Clear previousViewportFrame to signal renderNow() to do a full redraw
      this.previousViewportFrame = [];
      this.lastRenderedHeight = 0;
      
      // Trigger re-render of all content with new width
      // NOTE: onKeepAlive() will call reRenderLastContent() which calls flush(),
      // so we don't need to call scheduleRender() here - that would cause double rendering
      if (this.onKeepAlive) {
        this.onKeepAlive();
      }
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
