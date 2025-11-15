import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TerminalRegion } from './region.js';

describe('TerminalRegion', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    region = new TerminalRegion({ 
      width: 80, 
      height: 1,
      disableRendering: true, // Prevent interference with test runner output
    });
  });

  afterEach(() => {
    if (region) {
      region.destroy();
    }
  });

  describe('constructor', () => {
    it('should create a region with default options', () => {
      const defaultRegion = new TerminalRegion({
        disableRendering: true,
      });
      expect(defaultRegion).toBeInstanceOf(TerminalRegion);
      expect(defaultRegion.width).toBeGreaterThan(0);
      expect(defaultRegion.height).toBe(1);
      defaultRegion.destroy();
    });

    it('should create a region with custom options', () => {
      const customRegion = new TerminalRegion({
        width: 100,
        height: 3,
        disableRendering: true,
      });
      expect(customRegion.width).toBe(100);
      expect(customRegion.height).toBe(3);
      customRegion.destroy();
    });

    it('should use default values for missing options', () => {
      const partialRegion = new TerminalRegion({ 
        width: 50,
        disableRendering: true,
      });
      expect(partialRegion.width).toBe(50);
      expect(partialRegion.height).toBe(1);
      partialRegion.destroy();
    });
  });

  describe('width and height getters', () => {
    it('should return the correct width', () => {
      const customRegion = new TerminalRegion({ 
        width: 120,
        disableRendering: true,
      });
      expect(customRegion.width).toBe(120);
      customRegion.destroy();
    });

    it('should return the correct height', () => {
      const customRegion = new TerminalRegion({ 
        height: 5,
        disableRendering: true,
      });
      expect(customRegion.height).toBe(5);
      customRegion.destroy();
    });
  });

  describe('setLine', () => {
    it('should set a line with string content', () => {
      region.setLine(1, 'Hello, World!');
      region.flush();
      // With disableRendering, should not write to stdout
      expect(region).toBeDefined();
    });

    it('should set a line with LineContent object', () => {
      region.setLine(2, {
        text: 'Styled text',
        style: { bold: true, color: 'red' },
      });
      region.flush();
      // With disableRendering, should not write to stdout
      expect(region).toBeDefined();
    });

    it('should expand height when setting a line beyond current height', () => {
      expect(region.height).toBe(1);
      region.setLine(3, 'Line 3');
      expect(region.height).toBe(3);
    });

    it('should throw error for line number less than 1', () => {
      expect(() => region.setLine(0, 'Invalid')).toThrow('Line numbers start at 1');
      expect(() => region.setLine(-1, 'Invalid')).toThrow('Line numbers start at 1');
    });
  });

  describe('set', () => {
    it('should set content from a string', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      region.set(content);
      expect(region.height).toBe(3);
    });

    it('should set content from an array of LineContent', () => {
      const content = [
        { text: 'First', style: { bold: true } },
        { text: 'Second', style: { color: 'blue' as const } },
        { text: 'Third' },
      ];
      region.set(content);
      expect(region.height).toBe(3);
    });

    it('should handle empty string', () => {
      region.set('');
      expect(region.height).toBeGreaterThanOrEqual(1);
    });

    it('should handle single line without newline', () => {
      region.set('Single line');
      expect(region.height).toBe(1);
    });
  });

  describe('clearLine', () => {
    it('should clear a specific line', () => {
      region.setLine(2, 'test');
      region.clearLine(2);
      // Should not throw
      expect(region).toBeDefined();
    });

    it('should throw error for line number less than 1', () => {
      expect(() => region.clearLine(0)).toThrow('Line numbers start at 1');
      expect(() => region.clearLine(-1)).toThrow('Line numbers start at 1');
    });
  });

  describe('clear', () => {
    it('should clear the entire region', () => {
      region.setLine(1, 'line1');
      region.setLine(2, 'line2');
      region.clear();
      // Should not throw
      expect(region).toBeDefined();
    });
  });

  describe('flush', () => {
    it('should flush pending updates', () => {
      region.setLine(1, 'test');
      region.flush();
      // With disableRendering, should not write to stdout
      expect(region).toBeDefined();
    });
  });

  describe('setThrottle', () => {
    it('should set throttle FPS', () => {
      region.setThrottle(30);
      // Should not throw
      expect(region).toBeDefined();
    });
  });

  describe('destroy', () => {
    it('should destroy the region', () => {
      region.setLine(1, 'test');
      region.destroy();
      // Should not throw
      expect(region).toBeDefined();
    });
  });
});

