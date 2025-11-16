import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Col } from './col';
import { TerminalRegion } from '../region';

describe('Col', () => {
  let region: TerminalRegion;
  let setLineSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setLineSpy = vi.fn();
    const lines = new Map<number, string>();
    region = {
      setLine: (line: number, content: string) => {
        lines.set(line, content);
        setLineSpy(line, content);
      },
      getLine: (line: number) => lines.get(line) || '',
      width: 80,
    } as unknown as TerminalRegion;
  });

  describe('constructor', () => {
    it('should create a column with default options', () => {
      const col = new Col(region, 'Hello');
      expect(col.getPreferredWidth()).toBe(5);
      expect(col.getHeight()).toBe(1);
    });

    it('should handle flex option', () => {
      const col = new Col(region, 'Hello', { flex: 2 });
      expect((col as any).flexGrow).toBe(2);
    });

    it('should handle min option', () => {
      const col = new Col(region, 'Hello', { min: 10 });
      expect(col.getMinWidth()).toBe(10);
    });

    it('should handle max option', () => {
      const col = new Col(region, 'Hello', { max: 5 });
      expect(col.getMaxWidth()).toBe(5);
    });

    it('should default min to content width', () => {
      const col = new Col(region, 'Hello World');
      expect(col.getMinWidth()).toBe(11); // "Hello World".length
    });

    it('should strip ANSI codes when calculating width', () => {
      const col = new Col(region, '\x1b[31mHello\x1b[0m');
      expect(col.getPreferredWidth()).toBe(5); // Just "Hello"
      expect(col.getMinWidth()).toBe(5);
    });
  });

  describe('overflow handling', () => {
    it('should truncate with ellipsis-end by default', () => {
      const col = new Col(region, 'Very long text that exceeds width', { max: 10 });
      col.render(0, 1, 10);
      expect(setLineSpy).toHaveBeenCalledWith(1, expect.stringMatching(/\.\.\./));
    });

    it('should truncate with ellipsis-start', () => {
      const col = new Col(region, 'Very long text', { max: 10, overflow: 'ellipsis-start' });
      col.render(0, 1, 10);
      const call = setLineSpy.mock.calls[0];
      expect(call[1]).toMatch(/^\.\.\./);
    });

    it('should truncate with ellipsis-middle', () => {
      const col = new Col(region, 'Very long text', { max: 10, overflow: 'ellipsis-middle' });
      col.render(0, 1, 10);
      const call = setLineSpy.mock.calls[0];
      expect(call[1]).toMatch(/\.\.\./);
      // Should have text on both sides
      expect(call[1].indexOf('...')).toBeGreaterThan(0);
      expect(call[1].indexOf('...')).toBeLessThan(call[1].length - 3);
    });

    it('should wrap text when overflow is wrap', () => {
      const col = new Col(region, 'Very long text that wraps', { overflow: 'wrap' });
      // getHeight() for wrap needs width, but width is only available during render
      // Without width, it defaults to contentWidth, which may not wrap
      // So we test that render actually wraps correctly
      col.render(0, 1, 10);
      // Should render multiple lines for wrapped text
      expect(setLineSpy).toHaveBeenCalledTimes(3); // "Very long ", "text that ", "wraps"
    });

    it('should not truncate when overflow is none', () => {
      const col = new Col(region, 'Very long text', { max: 10, overflow: 'none' });
      col.render(0, 1, 10);
      const call = setLineSpy.mock.calls[0];
      expect(call[1]).not.toMatch(/\.\.\./);
    });
  });

  describe('render', () => {
    it('should pad text to width', () => {
      const col = new Col(region, 'Hi');
      col.render(0, 1, 10);
      expect(setLineSpy).toHaveBeenCalledWith(1, expect.stringMatching(/^Hi\s{8}$/));
    });

    it('should handle exact width match', () => {
      const col = new Col(region, 'Hello');
      col.render(0, 1, 5);
      expect(setLineSpy).toHaveBeenCalledWith(1, 'Hello');
    });
  });
});

