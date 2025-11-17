import { describe, it, expect, beforeEach } from 'vitest';
import { grid, resolveGrid } from './grid';
import { style } from './grid';
import { TerminalRegion } from '../region';

describe('Grid API', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    region = new TerminalRegion({ disableRendering: true, width: 80 });
  });

  describe('grid()', () => {
    it('should create a grid descriptor', () => {
      const descriptor = grid({ template: [20, '1*'] }, 'A', 'B');
      
      expect(descriptor.type).toBe('grid');
      expect(descriptor.options.template).toEqual([20, '1*']);
      expect(descriptor.children.length).toBe(2);
    });

    it('should convert strings to style components', () => {
      const descriptor = grid({ template: [20, '1*'] }, 'A', 'B');
      
      expect(descriptor.children.length).toBe(2);
      // Both should be Components (functions)
      expect(typeof descriptor.children[0]).toBe('function');
      expect(typeof descriptor.children[1]).toBe('function');
    });

    it('should accept Component children', () => {
      const childComponent = style({ color: 'red' }, 'Hello');
      const descriptor = grid({ template: [20, '1*'] }, childComponent);
      
      expect(descriptor.children.length).toBe(1);
      expect(descriptor.children[0]).toBe(childComponent);
    });
  });

  describe('resolveGrid', () => {
    it('should resolve grid descriptor to GridComponent', () => {
      const descriptor = grid({ template: [20, '1*'] }, 'A', 'B');
      const gridComponent = resolveGrid(region, descriptor);
      
      expect(gridComponent).toBeDefined();
      expect(gridComponent.getHeight()).toBe(1);
    });

    it('should render resolved grid', () => {
      const descriptor = grid({ template: [20, '1*'] }, 'A', 'B');
      const gridComponent = resolveGrid(region, descriptor);
      
      gridComponent.render(0, 1, 80);
      
      const line = region.getLine(1);
      expect(line).toContain('A');
      expect(line).toContain('B');
    });
  });
});

