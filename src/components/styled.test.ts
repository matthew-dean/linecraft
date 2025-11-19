import { describe, it, expect, beforeEach } from 'vitest';
import { Styled } from './styled';
import { TerminalRegion } from '../region';

describe('Style Component', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    region = new TerminalRegion({ disableRendering: true, width: 80 });
  });

  describe('basic styling', () => {
    it('should apply color', () => {
      const component = Styled({ color: 'red' }, 'Hello');
      const result = component({
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      });
      
      expect(result).toContain('Hello');
      expect(result).toContain('\x1b[31m'); // ANSI red
    });

    it('should apply backgroundColor', () => {
      const component = Styled({ backgroundColor: 'blue' }, 'Hello');
      const result = component({
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      });
      
      expect(result).toContain('Hello');
      expect(result).toContain('\x1b[44m'); // ANSI blue background
    });

    it('should apply bold', () => {
      const component = Styled({ bold: true }, 'Hello');
      const result = component({
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      });
      
      expect(result).toContain('\x1b[1m'); // ANSI bold
    });
  });

  describe('overflow handling', () => {
    it('should truncate with ellipsis-end', () => {
      const component = Styled({ overflow: 'ellipsis-end' }, 'This is a very long text');
      const result = component({
        availableWidth: 10,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      });
      
      const plain = (result as string).replace(/\x1b\[[0-9;]*m/g, '');
      expect(plain).toMatch(/\.\.\.$/);
      expect(plain.length).toBeLessThanOrEqual(10);
    });

    it('should truncate with ellipsis-start', () => {
      const component = Styled({ overflow: 'ellipsis-start' }, 'This is a very long text');
      const result = component({
        availableWidth: 10,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      });
      
      const plain = (result as string).replace(/\x1b\[[0-9;]*m/g, '');
      expect(plain).toMatch(/^\.\.\./);
      expect(plain.length).toBeLessThanOrEqual(10);
    });

    it('should wrap text', () => {
      const component = Styled({ overflow: 'wrap' }, 'This is a very long text that should wrap');
      const result = component({
        availableWidth: 10,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      });
      
      expect(Array.isArray(result)).toBe(true);
      expect((result as string[]).length).toBeGreaterThan(1);
    });
  });

  describe('when condition', () => {
    it('should return null when condition is false', () => {
      const component = Styled({ when: () => false }, 'Hello');
      const result = component({
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      });
      
      expect(result).toBeNull();
    });

    it('should return content when condition is true', () => {
      const component = Styled({ when: (ctx) => ctx.availableWidth > 50 }, 'Hello');
      const result = component({
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      });
      
      expect(result).toContain('Hello');
    });

    it('should check availableWidth in condition', () => {
      const component = Styled({ when: (ctx) => ctx.availableWidth > 50 }, 'Hello');
      
      const result1 = component({
        availableWidth: 40,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      });
      expect(result1).toBeNull();
      
      const result2 = component({
        availableWidth: 60,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      });
      expect(result2).toContain('Hello');
    });
  });

  describe('multi-line content', () => {
    it('should apply styling to each line', () => {
      const component = Styled({ color: 'red' }, ['Line 1', 'Line 2']);
      const result = component({
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      });
      
      expect(Array.isArray(result)).toBe(true);
      expect((result as string[]).length).toBe(2);
      expect((result as string[])[0]).toContain('Line 1');
      expect((result as string[])[1]).toContain('Line 2');
    });
  });
});

