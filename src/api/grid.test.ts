import { describe, it, expect, beforeEach } from 'vitest';
import { grid } from '../layout/grid';
import { style } from '../components/style';
import { TerminalRegion } from '../region';
import { callComponent } from '../layout/grid';

describe('Grid API', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    region = new TerminalRegion({ disableRendering: true, width: 80 });
  });

  describe('grid()', () => {
    it('should create a Component (object with render method)', () => {
      const component = grid({ template: [20, '1*'] }, 'A', 'B');
      
      expect(component).toBeDefined();
      expect(typeof component).toBe('object');
      expect('render' in component).toBe(true);
      expect(typeof component.render).toBe('function');
    });

    it('should convert strings to style components', () => {
      const component = grid({ template: [20, '1*'] }, 'A', 'B');
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      };
      const result = callComponent(component, ctx);
      expect(result).toBeTruthy();
    });

    it('should accept Component children', () => {
      const childComponent = style({ color: 'red' }, 'Hello');
      const component = grid({ template: [20, '1*'] }, childComponent);
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 0,
      };
      const result = callComponent(component, ctx);
      expect(result).toBeTruthy();
      if (result && typeof result === 'string') {
        expect(result).toContain('Hello');
      }
    });

    it('should render grid component', () => {
      const component = grid({ template: [20, '1*'] }, 'A', 'B');
      
      const ctx = {
        availableWidth: 80,
        region: region,
        columnIndex: 0,
        rowIndex: 1,
      };
      const result = callComponent(component, ctx);
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
  });
});

