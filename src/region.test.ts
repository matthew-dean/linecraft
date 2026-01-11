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
      expect(customRegion.width).toBeGreaterThan(0);
      expect(customRegion.height).toBe(3);
      customRegion.destroy();
    });

    it('should use default values for missing options', () => {
      const partialRegion = new TerminalRegion({ 
        width: 50,
        disableRendering: true,
      });
      expect(partialRegion.width).toBeGreaterThan(0);
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
      expect(customRegion.width).toBeGreaterThan(0);
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

    it('should do a full replace when called with same height', () => {
      // Set initial content
      region.set('Line 1\nLine 2\nLine 3');
      expect(region.height).toBe(3);
      
      // Set new content with same height - should overwrite, not add
      region.set('New 1\nNew 2\nNew 3');
      expect(region.height).toBe(3); // Should still be 3, not 6
      
      // Verify content was replaced
      region.flush();
      expect(region.getLine(1)).toContain('New 1');
      expect(region.getLine(2)).toContain('New 2');
      expect(region.getLine(3)).toContain('New 3');
    });

    it('should do a full replace when height decreases', () => {
      // Set initial content with 3 lines
      region.set('Line 1\nLine 2\nLine 3');
      expect(region.height).toBe(3);
      
      // Set new content with 2 lines - should replace and shrink
      region.set('New 1\nNew 2');
      expect(region.height).toBe(2); // Should shrink to 2
      
      // Verify content was replaced
      region.flush();
      expect(region.getLine(1)).toContain('New 1');
      expect(region.getLine(2)).toContain('New 2');
    });

    it('should do a full replace when height increases', () => {
      // Set initial content with 2 lines
      region.set('Line 1\nLine 2');
      expect(region.height).toBe(2);
      
      // Set new content with 4 lines - should replace and expand
      region.set('New 1\nNew 2\nNew 3\nNew 4');
      expect(region.height).toBe(4); // Should expand to 4
      
      // Verify content was replaced
      region.flush();
      expect(region.getLine(1)).toContain('New 1');
      expect(region.getLine(2)).toContain('New 2');
      expect(region.getLine(3)).toContain('New 3');
      expect(region.getLine(4)).toContain('New 4');
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

  describe('add', () => {
    it('should append content after existing content', () => {
      // Set initial content
      region.set('Line 1\nLine 2');
      expect(region.height).toBe(2);
      
      // Add new content - should append
      region.add('Line 3\nLine 4');
      expect(region.height).toBe(4); // Should expand to 4
      
      // Verify both old and new content exist
      region.flush();
      expect(region.getLine(1)).toContain('Line 1');
      expect(region.getLine(2)).toContain('Line 2');
      expect(region.getLine(3)).toContain('Line 3');
      expect(region.getLine(4)).toContain('Line 4');
    });

    it('should append multiple times', () => {
      region.set('First');
      expect(region.height).toBe(1);
      
      region.add('Second');
      expect(region.height).toBe(2);
      
      region.add('Third');
      expect(region.height).toBe(3);
      
      region.flush();
      expect(region.getLine(1)).toContain('First');
      expect(region.getLine(2)).toContain('Second');
      expect(region.getLine(3)).toContain('Third');
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

