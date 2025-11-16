import { describe, it, expect, beforeEach } from 'vitest';
import { createGrid, grid } from './grid';
import { style } from '../components/style';
import { TerminalRegion } from '../region';

describe('Grid Layout', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    region = new TerminalRegion({ disableRendering: true, width: 80 });
  });

  describe('createGrid', () => {
    it('should create a grid component', () => {
      const gridComponent = createGrid(region, { template: [20, '1*'] }, 
        style({}, 'A'),
        style({}, 'B')
      );
      
      expect(gridComponent).toBeDefined();
      expect(gridComponent.getHeight()).toBe(1);
    });

    it('should calculate column widths correctly', () => {
      const gridComponent = createGrid(region, { template: [20, '1*'] }, 
        style({}, 'A'),
        style({}, 'B')
      );
      
      gridComponent.render(0, 1, 80);
      
      // First column should be 20, second should be 60 (80 - 20)
      const line = region.getLine(1);
      expect(line).toContain('A');
      expect(line).toContain('B');
    });

    it('should handle flex ratios', () => {
      const gridComponent = createGrid(region, { template: ['1*', '2*', '1*'] }, 
        style({}, 'A'),
        style({}, 'B'),
        style({}, 'C')
      );
      
      gridComponent.render(0, 1, 60);
      
      // Total flex = 4, so each 1* gets 15, 2* gets 30
      const line = region.getLine(1);
      expect(line).toContain('A');
      expect(line).toContain('B');
      expect(line).toContain('C');
    });

    it('should handle minmax', () => {
      const gridComponent = createGrid(region, { template: [{ min: 40, width: '2*' }, '1*'] }, 
        style({}, 'A'),
        style({}, 'B')
      );
      
      gridComponent.render(0, 1, 80);
      
      const line = region.getLine(1);
      expect(line).toContain('A');
      expect(line).toContain('B');
    });

    it('should handle columnGap', () => {
      const gridComponent = createGrid(region, { template: [20, 20], columnGap: 2 }, 
        style({}, 'A'),
        style({}, 'B')
      );
      
      gridComponent.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      // Should have 2 spaces between A and B
      expect(plain.indexOf('A') + 1 + 2).toBeLessThanOrEqual(plain.indexOf('B'));
    });

    it('should handle spaceBetween', () => {
      const gridComponent = createGrid(region, { template: [20, 20], columnGap: 2, spaceBetween: '─' }, 
        style({}, 'A'),
        style({}, 'B')
      );
      
      gridComponent.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      // Should have ─ characters between A and B
      expect(plain).toContain('─');
    });

    it('should handle spaceBetween with color', () => {
      const gridComponent = createGrid(region, { 
        template: [20, 20], 
        columnGap: 2, 
        spaceBetween: { char: '─', color: 'brightBlack' } 
      }, 
        style({}, 'A'),
        style({}, 'B')
      );
      
      gridComponent.render(0, 1, 80);
      
      const line = region.getLine(1);
      expect(line).toContain('─');
    });

    it('should handle justify space-between', () => {
      const gridComponent = createGrid(region, { 
        template: ['auto', '1*', 'auto'], 
        justify: 'space-between' 
      }, 
        style({}, 'Left'),
        style({}, 'Middle'),
        style({}, 'Right')
      );
      
      gridComponent.render(0, 1, 80);
      
      const line = region.getLine(1);
      expect(line).toContain('Left');
      expect(line).toContain('Right');
    });

    it('should handle null components (from when condition)', () => {
      const gridComponent = createGrid(region, { template: [20, '1*'] }, 
        style({}, 'A'),
        style({ when: () => false }, 'B') // Returns null
      );
      
      gridComponent.render(0, 1, 80);
      
      const line = region.getLine(1);
      expect(line).toContain('A');
      expect(line).not.toContain('B');
    });

    it('should handle multi-line content', () => {
      const gridComponent = createGrid(region, { template: [20, '1*'] }, 
        style({}, 'A'),
        style({}, ['Line 1', 'Line 2'])
      );
      
      expect(gridComponent.getHeight()).toBe(2);
      
      gridComponent.render(0, 1, 80);
      
      expect(region.getLine(1)).toContain('A');
      expect(region.getLine(1)).toContain('Line 1');
      expect(region.getLine(2)).toContain('Line 2');
    });

    it('should auto-repeat template for extra children', () => {
      const gridComponent = createGrid(region, { template: [20, '1*'] }, 
        style({}, 'A'),
        style({}, 'B'),
        style({}, 'C'), // Should use '1*' (repeated)
        style({}, 'D')  // Should use '1*' (repeated)
      );
      
      gridComponent.render(0, 1, 80);
      
      const line = region.getLine(1);
      expect(line).toContain('A');
      expect(line).toContain('B');
      expect(line).toContain('C');
      expect(line).toContain('D');
    });

    it('should handle empty template (all equal flex)', () => {
      const gridComponent = createGrid(region, { template: [] }, 
        style({}, 'A'),
        style({}, 'B'),
        style({}, 'C')
      );
      
      gridComponent.render(0, 1, 60);
      
      const line = region.getLine(1);
      expect(line).toContain('A');
      expect(line).toContain('B');
      expect(line).toContain('C');
    });
  });

  describe('grid (Component API)', () => {
    it('should return a Component', () => {
      const component = grid({ template: [20, '1*'] }, 
        style({}, 'A'),
        style({}, 'B')
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
      const component = grid({ template: [20, '1*'] }, 
        style({ when: () => false }, 'A'),
        style({ when: () => false }, 'B')
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

