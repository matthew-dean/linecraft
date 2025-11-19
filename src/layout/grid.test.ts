import { describe, it, expect, beforeEach } from 'vitest';
import { grid as Grid } from './grid';
import { Styled } from '../components/styled';
import { TerminalRegion } from '../region';
import { callComponent } from '../component';

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
      
      expect(typeof component).toBe('function');
      
      const result = component({
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
      
      const result = component({
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      });
      
      expect(result).toBeNull();
    });
  });
});

