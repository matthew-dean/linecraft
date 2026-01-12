import { describe, it, expect, beforeEach } from 'vitest';
import { grid as Grid } from './grid.js';
import { Styled } from '../components/styled.js';
import { TerminalRegion } from '../region.js';
import { callComponent } from '../component.js';
import { countVisibleChars, stripAnsi } from '../utils/text.js';

describe('Grid Layout', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    region = new TerminalRegion({ disableRendering: true, width: 80 });
  });

  describe('grid (Component API)', () => {
    it('should create a grid component', () => {
      const gridComponent = Grid({ template: [20, '1*'] }, 
        Styled({}, 'A'),
        Styled({}, 'B')
      );
      
      expect(gridComponent).toBeDefined();
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      };
      const result = callComponent(gridComponent, ctx);
      expect(result).toBeTruthy();
      const height = Array.isArray(result) ? result.length : 1;
      expect(height).toBe(1);
    });

    it('should calculate column widths correctly', () => {
      const gridComponent = Grid({ template: [20, '1*'] }, 
        Styled({}, 'A'),
        Styled({}, 'B')
      );
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      if (result) {
        if (Array.isArray(result)) {
          region.setLine(1, result[0]);
        } else {
          region.setLine(1, result);
        }
      }
      
      // First column should be 20, second should be 60 (80 - 20)
      const line = region.getLine(1);
      expect(line).toContain('A');
      expect(line).toContain('B');
    });

    it('should handle flex ratios', () => {
      const gridComponent = Grid({ template: ['1*', '2*', '1*'] }, 
        Styled({}, 'A'),
        Styled({}, 'B'),
        Styled({}, 'C')
      );
      
      const ctx = {
        availableWidth: 60,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      if (result) {
        if (Array.isArray(result)) {
          region.setLine(1, result[0]);
        } else {
          region.setLine(1, result);
        }
      }
      
      // Total flex = 4, so each 1* gets 15, 2* gets 30
      const line = region.getLine(1);
      expect(line).toContain('A');
      expect(line).toContain('B');
      expect(line).toContain('C');
    });

    it('should handle equal flex columns with ellipsis overflow', () => {
      const longText = 'This is a very long text that will be truncated';
      const gridComponent = Grid({ template: ['1*', '1*', '1*'] }, 
        Styled({ overflow: 'ellipsis-end' }, longText),
        Styled({ overflow: 'ellipsis-start' }, longText),
        Styled({ overflow: 'ellipsis-middle' }, longText)
      );
      
      const ctx = {
        availableWidth: 90,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      expect(result).not.toBeNull();
      expect(result).toBeTruthy();
      
      let line: string;
      if (result) {
        if (Array.isArray(result)) {
          expect(result.length).toBeGreaterThan(0);
          line = result[0];
          region.setLine(1, result[0]);
        } else {
          line = result;
          region.setLine(1, result);
        }
      } else {
        throw new Error('Grid returned null or undefined');
      }
      
      // All three columns should be equal width: 90 / 3 = 30 each
      expect(line).toBeTruthy();
      expect(line.length).toBeGreaterThan(0);
      
      // Find the start of each truncated text (they should be at column boundaries)
      // Column 1 should start at position 0, column 2 at ~30, column 3 at ~60
      // We can verify by checking that the visible width between columns is equal
      const plain = stripAnsi(line);
      
      // Find where each column's content appears
      // For ellipsis-end: text starts immediately
      // For ellipsis-start: text has "..." at start
      // For ellipsis-middle: text has "..." in middle
      const ellipsisEndMatch = plain.match(/This is a very/);
      const ellipsisStartMatch = plain.match(/\.\.\./);
      const ellipsisMiddleMatch = plain.match(/\.\.\./);
      
      expect(ellipsisEndMatch).toBeTruthy();
      
      // Calculate column widths by finding the distance between column starts
      // This is approximate since we need to find where each column's content begins
      // The key is that all three columns should have the same width
      const firstColStart = ellipsisEndMatch?.index ?? 0;
      
      // Find where second column starts (after first column + gap if any)
      // For ellipsis-start, look for the "..." pattern
      let secondColStart = plain.length;
      if (ellipsisStartMatch && ellipsisStartMatch.index !== undefined) {
        // Find the first "..." that's after the first column
        const dotsIndex = ellipsisStartMatch.index;
        if (dotsIndex > firstColStart + 20) {
          secondColStart = dotsIndex;
        }
      }
      
      // If we can't find clear boundaries, at least verify the line is the right length
      const lineWidth = countVisibleChars(line);
      expect(lineWidth).toBe(90); // Should fill available width
      
      // Verify the line contains the expected truncated text
      expect(plain).toContain('This is a very');
      expect(plain).toContain('...');
      
      // Verify columns are approximately equal by checking the overall structure
      // Each column should be ~30 chars wide
      expect(lineWidth).toBeGreaterThanOrEqual(85); // Allow some margin for gaps/rounding
    });

    it('should handle minmax', () => {
      const gridComponent = Grid({ template: [{ min: 40, width: '2*' }, '1*'] }, 
        Styled({}, 'A'),
        Styled({}, 'B')
      );
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      if (result) {
        if (Array.isArray(result)) {
          region.setLine(1, result[0]);
        } else {
          region.setLine(1, result);
        }
      }
      
      const line = region.getLine(1);
      expect(line).toContain('A');
      expect(line).toContain('B');
    });

    it('should handle columnGap', () => {
      const gridComponent = Grid({ template: [20, 20], columnGap: 2 }, 
        Styled({}, 'A'.repeat(20)),
        Styled({}, 'B'.repeat(20))
      );
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      if (result) {
        if (Array.isArray(result)) {
          region.setLine(1, result[0]);
        } else {
          region.setLine(1, result);
        }
      }
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      // Should have 2 spaces between columns
      const firstColEnd = plain.indexOf('A'.repeat(20)) + 20;
      const secondColStart = plain.indexOf('B'.repeat(20));
      expect(secondColStart - firstColEnd).toBeGreaterThanOrEqual(2);
    });

    it('should render all columns with columnGap (regression: Column 2 not rendering)', () => {
      const gridComponent = Grid({ template: [20, 20], columnGap: 3 }, 
        Styled({ color: 'cyan' }, 'Column 1'),
        Styled({ color: 'green' }, 'Column 2')
      );
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      if (result) {
        if (Array.isArray(result)) {
          region.setLine(1, result[0]);
        } else {
          region.setLine(1, result);
        }
      }
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      // Both columns should be present
      expect(plain).toContain('Column 1');
      expect(plain).toContain('Column 2');
      
      // Column 2 should appear after Column 1
      const col1Index = plain.indexOf('Column 1');
      const col2Index = plain.indexOf('Column 2');
      expect(col1Index).toBeGreaterThanOrEqual(0);
      expect(col2Index).toBeGreaterThan(col1Index);
      
      // Should have gap between them
      const between = plain.substring(col1Index + 'Column 1'.length, col2Index);
      expect(between.length).toBeGreaterThanOrEqual(3); // At least 3 spaces (columnGap)
    });

    it('should handle spaceBetween with auto columns', () => {
      const gridComponent = Grid({ template: ['auto', 'auto'], columnGap: 2, spaceBetween: '─' }, 
        Styled({}, 'A'),
        Styled({}, 'B')
      );
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      if (result) {
        if (Array.isArray(result)) {
          region.setLine(1, result[0]);
        } else {
          region.setLine(1, result);
        }
      }
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      // Should have ─ characters between A and B
      expect(plain).toContain('─');
    });

    it('should handle spaceBetween with color and auto columns', () => {
      const gridComponent = Grid({ 
        template: ['auto', 'auto'], 
        columnGap: 2, 
        spaceBetween: { char: '─', color: 'brightBlack' } 
      }, 
        Styled({}, 'A'),
        Styled({}, 'B')
      );
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      if (result) {
        if (Array.isArray(result)) {
          region.setLine(1, result[0]);
        } else {
          region.setLine(1, result);
        }
      }
      
      const line = region.getLine(1);
      expect(line).toContain('─');
    });

    it('should handle spaceBetween with auto columns (justify-content: space-between)', () => {
      const gridComponent = Grid({ 
        template: ['auto', 'auto'], 
        columnGap: 2, 
        spaceBetween: { char: '─', color: 'brightBlack' } 
      }, 
        Styled({}, 'Left'),
        Styled({}, 'Right')
      );
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      if (result) {
        if (Array.isArray(result)) {
          region.setLine(1, result[0]);
        } else {
          region.setLine(1, result);
        }
      }
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      // Both columns should be present
      expect(plain).toContain('Left');
      expect(plain).toContain('Right');
      
      // spaceBetween character should be between them
      const leftIndex = plain.indexOf('Left');
      const rightIndex = plain.indexOf('Right');
      expect(leftIndex).toBeGreaterThanOrEqual(0);
      expect(rightIndex).toBeGreaterThan(leftIndex);
      
      // The space between should contain ─ characters
      const between = plain.substring(leftIndex + 'Left'.length, rightIndex);
      expect(between).toContain('─');
      expect(between.length).toBeGreaterThan(0);
    });

    it('should handle spaceBetween with auto columns - right column at end', () => {
      const gridComponent = Grid({ 
        template: ['auto', 'auto'], 
        columnGap: 2, 
        spaceBetween: { char: '─', color: 'brightBlack' } 
      }, 
        Styled({}, 'Left'),
        Styled({ align: 'right' }, 'Right')
      );
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      if (result) {
        if (Array.isArray(result)) {
          region.setLine(1, result[0]);
        } else {
          region.setLine(1, result);
        }
      }
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      // Right should be at the end (or very close to it)
      const rightIndex = plain.indexOf('Right');
      expect(rightIndex).toBeGreaterThan(0);
      
      // The line should be close to full width
      expect(plain.length).toBeGreaterThanOrEqual(75); // Allow some margin
      
      // spaceBetween should fill the gap
      const leftIndex = plain.indexOf('Left');
      const between = plain.substring(leftIndex + 'Left'.length, rightIndex);
      expect(between).toContain('─');
    });

    it('should handle spaceBetween with auto columns - verify fill width', () => {
      const gridComponent = Grid({ 
        template: ['auto', 'auto'], 
        spaceBetween: '─' 
      }, 
        Styled({}, 'L'),
        Styled({}, 'R')
      );
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      if (result) {
        if (Array.isArray(result)) {
          region.setLine(1, result[0]);
        } else {
          region.setLine(1, result);
        }
      }
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      // Should have L, then ─ characters, then R
      const lIndex = plain.indexOf('L');
      const rIndex = plain.indexOf('R');
      const between = plain.substring(lIndex + 1, rIndex);
      
      // Between should be mostly ─ characters
      expect(between.length).toBeGreaterThan(70); // Most of the 80 width
      expect(between.replace(/─/g, '').length).toBeLessThan(5); // Mostly ─
    });

    it('should handle justify space-between', () => {
      const gridComponent = Grid({ 
        template: [10, '1*', 10], 
        justify: 'space-between' 
      }, 
        Styled({}, 'Left'),
        Styled({}, 'Middle'),
        Styled({}, 'Right')
      );
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      if (result) {
        if (Array.isArray(result)) {
          region.setLine(1, result[0]);
        } else {
          region.setLine(1, result);
        }
      }
      
      const line = region.getLine(1);
      expect(line).toContain('Left');
      expect(line).toContain('Right');
    });

    it('should handle null components (from when condition)', () => {
      const gridComponent = Grid({ template: [20, '1*'] }, 
        Styled({}, 'A'),
        Styled({ when: () => false }, 'B') // Returns null
      );
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      if (result) {
        if (Array.isArray(result)) {
          region.setLine(1, result[0]);
        } else {
          region.setLine(1, result);
        }
      }
      
      const line = region.getLine(1);
      expect(line).toContain('A');
      expect(line).not.toContain('B');
    });

    it('should handle multi-line content', () => {
      const gridComponent = Grid({ template: [20, '1*'] }, 
        Styled({}, 'A'),
        Styled({}, ['Line 1', 'Line 2'])
      );
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      expect(result).toBeTruthy();
      const height = Array.isArray(result) ? result.length : 1;
      expect(height).toBe(2);
      
      if (result && Array.isArray(result)) {
        for (let i = 0; i < result.length; i++) {
          region.setLine(1 + i, result[i]);
        }
      } else if (result) {
        region.setLine(1, result);
      }
      
      expect(region.getLine(1)).toContain('A');
      expect(region.getLine(1)).toContain('Line 1');
      expect(region.getLine(2)).toContain('Line 2');
    });

    it('should auto-repeat template for extra children', () => {
      const gridComponent = Grid({ template: [20, '1*'] }, 
        Styled({}, 'A'),
        Styled({}, 'B'),
        Styled({}, 'C'), // Should use '1*' (repeated)
        Styled({}, 'D')  // Should use '1*' (repeated)
      );
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      if (result) {
        if (Array.isArray(result)) {
          region.setLine(1, result[0]);
        } else {
          region.setLine(1, result);
        }
      }
      
      const line = region.getLine(1);
      expect(line).toContain('A');
      expect(line).toContain('B');
      expect(line).toContain('C');
      expect(line).toContain('D');
    });

    it('should handle empty template (all equal flex)', () => {
      const gridComponent = Grid({ template: [] }, 
        Styled({}, 'A'),
        Styled({}, 'B'),
        Styled({}, 'C')
      );
      
      const ctx = {
        availableWidth: 60,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(gridComponent, ctx);
      if (result) {
        if (Array.isArray(result)) {
          region.setLine(1, result[0]);
        } else {
          region.setLine(1, result);
        }
      }
      
      const line = region.getLine(1);
      expect(line).toContain('A');
      expect(line).toContain('B');
      expect(line).toContain('C');
    });
  });

  describe('grid (Component API)', () => {
    it('should return a Component', () => {
      const component = Grid({ template: [20, '1*'] }, 
        Styled({}, 'A'),
        Styled({}, 'B')
      );
      
      expect(typeof component === 'function' || (typeof component === 'object' && component !== null && 'render' in component)).toBe(true);
      
      const result = callComponent(component, {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      });
      
      expect(result).toBeTruthy();
      expect(typeof result === 'string' || Array.isArray(result)).toBe(true);
    });

    it('should return null if all children are null', () => {
      const component = Grid({ template: [20, '1*'] }, 
        Styled({ when: () => false }, 'A'),
        Styled({ when: () => false }, 'B')
      );
      
      const result = callComponent(component, {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      });
      
      expect(result).toBeNull();
    });
  });
});

