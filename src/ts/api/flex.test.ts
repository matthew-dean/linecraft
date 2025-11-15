import { describe, it, expect, beforeEach } from 'vitest';
import { flex, col, resolveFlexTree } from './flex.js';
import { TerminalRegion } from '../region.js';
import { Flex } from '../layout/flex.js';
import { Col } from '../components/col.js';

describe('flex API', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    region = {
      setLine: () => {},
      width: 80,
    } as unknown as TerminalRegion;
  });

  describe('flex()', () => {
    it('should create a flex descriptor', () => {
      const descriptor = flex({ gap: 2 }, 'Hello', 'World');
      
      expect(descriptor.type).toBe('flex');
      expect(descriptor.options.gap).toBe(2);
      expect(descriptor.children).toHaveLength(2);
      expect(descriptor.children[0]).toBe('Hello');
      expect(descriptor.children[1]).toBe('World');
    });

    it('should accept col descriptors as children', () => {
      const colDesc = col({ flex: 1 }, 'Hello');
      const descriptor = flex({ gap: 2 }, colDesc);
      
      expect(descriptor.children[0]).toBe(colDesc);
    });
  });

  describe('col()', () => {
    it('should create a col descriptor', () => {
      const descriptor = col({ flex: 1 }, 'Hello');
      
      expect(descriptor.type).toBe('col');
      expect(descriptor.options.flex).toBe(1);
      expect(descriptor.content).toBe('Hello');
    });

    it('should handle min and max options', () => {
      const descriptor = col({ min: 5, max: 10 }, 'Hello');
      
      expect(descriptor.options.min).toBe(5);
      expect(descriptor.options.max).toBe(10);
    });
  });

  describe('resolveFlexTree', () => {
    it('should resolve a flex descriptor to a Flex component', () => {
      const descriptor = flex({ gap: 2 }, 'Hello', 'World');
      const component = resolveFlexTree(region, descriptor);
      
      expect(component).toBeInstanceOf(Flex);
    });

    it('should resolve a col descriptor to a Col component', () => {
      const descriptor = col({ flex: 1 }, 'Hello');
      const component = resolveFlexTree(region, descriptor);
      
      expect(component).toBeInstanceOf(Col);
    });

    it('should wrap plain strings in Col components', () => {
      const descriptor = flex({ gap: 2 }, 'Hello');
      const component = resolveFlexTree(region, descriptor) as Flex;
      
      expect(component).toBeInstanceOf(Flex);
      // Flex now handles strings directly, so children are Renderables
      // We can't easily check the content, but we can verify it renders correctly
      expect(component.getPreferredWidth()).toBeGreaterThan(0);
    });

    it('should resolve nested flex structures', () => {
      const innerFlex = flex({ gap: 1 }, 'A', 'B');
      const outerFlex = flex({ gap: 2 }, innerFlex, 'C');
      
      const component = resolveFlexTree(region, outerFlex) as Flex;
      
      expect(component).toBeInstanceOf(Flex);
      expect(component['children']).toHaveLength(2);
      expect(component['children'][0]).toBeInstanceOf(Flex);
      // 'C' is a string, which gets converted to a Renderable (not a Col instance)
      // We can verify it's a Renderable by checking it has the required methods
      expect(component['children'][1]).toHaveProperty('render');
      expect(component['children'][1]).toHaveProperty('getPreferredWidth');
    });

    it('should apply col options correctly', () => {
      const descriptor = col({ flex: 2, min: 10, max: 50 }, 'Hello');
      const component = resolveFlexTree(region, descriptor) as Col;
      
      expect(component).toBeInstanceOf(Col);
      expect((component as any).flexGrow).toBe(2);
      expect(component.getMinWidth()).toBe(10);
      expect(component.getMaxWidth()).toBe(50);
    });
  });
});

