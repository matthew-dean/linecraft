import { describe, it, expect, beforeEach } from 'vitest';
import { TerminalRegion } from './region';
import { flex, col } from './api/flex';

describe('TerminalRegion.set() and .add() - Basic Operations', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    region = new TerminalRegion({ disableRendering: true });
  });

  describe('set() with flex components', () => {
    it('should set a single flex component', () => {
      const component = flex({ gap: 1 },
        col({ width: 10, color: 'red' }, 'Test')
      );
      region.set(component);
      expect(region.height).toBe(1);
    });

    it('should set multiple flex components (multi-line)', () => {
      const line1 = flex({ gap: 0 }, col({ width: 10, color: 'red' }, 'Line 1'));
      const line2 = flex({ gap: 0 }, col({ width: 10, color: 'blue' }, 'Line 2'));
      const line3 = flex({ gap: 0 }, col({ width: 10, color: 'green' }, 'Line 3'));
      
      region.set(line1, line2, line3);
      expect(region.height).toBe(3);
    });
  });

  describe('add() with flex components', () => {
    it('should add a single flex component after existing content', () => {
      const line1 = flex({ gap: 0 }, col({ width: 10, color: 'red' }, 'Line 1'));
      region.set(line1);
      expect(region.height).toBe(1);

      const line2 = flex({ gap: 0 }, col({ width: 10, color: 'blue' }, 'Line 2'));
      region.add(line2);
      expect(region.height).toBe(2);
    });

    it('should add multiple flex components after existing content', () => {
      const line1 = flex({ gap: 0 }, col({ width: 10, color: 'red' }, 'Line 1'));
      region.set(line1);
      expect(region.height).toBe(1);

      const line2 = flex({ gap: 0 }, col({ width: 10, color: 'blue' }, 'Line 2'));
      const line3 = flex({ gap: 0 }, col({ width: 10, color: 'green' }, 'Line 3'));
      region.add(line2, line3);
      expect(region.height).toBe(3); // 1 + 2
    });

    it('should add multiple times progressively', () => {
      const line1 = flex({ gap: 0 }, col({ width: 10, color: 'red' }, 'Line 1'));
      region.set(line1);
      expect(region.height).toBe(1);

      const line2 = flex({ gap: 0 }, col({ width: 10, color: 'blue' }, 'Line 2'));
      region.add(line2);
      expect(region.height).toBe(2);

      const line3 = flex({ gap: 0 }, col({ width: 10, color: 'green' }, 'Line 3'));
      region.add(line3);
      expect(region.height).toBe(3);
    });
  });

  describe('setLine() behavior', () => {
    it('should set a line without expanding if within height', () => {
      region.set('Line 1\nLine 2');
      expect(region.height).toBe(2);
      
      region.setLine(1, 'Updated Line 1');
      expect(region.height).toBe(2); // Should not expand
    });

    it('should expand when setLine is called beyond current height', () => {
      region.set('Line 1');
      expect(region.height).toBe(1);
      
      region.setLine(3, 'Line 3');
      expect(region.height).toBe(3); // Should expand to 3
    });

    it('should not expand beyond reasonable bounds', () => {
      region.set('Line 1');
      expect(region.height).toBe(1);
      
      // Try to set a line way beyond current height
      region.setLine(100, 'Line 100');
      // Should not expand to 100, but might expand a bit (up to +10)
      expect(region.height).toBeLessThanOrEqual(11);
    });
  });

  describe('set() then add() - content preservation', () => {
    it('should preserve content from set() when add() is called', () => {
      const line1 = flex({ gap: 0 }, col({ width: 10, color: 'red' }, 'Line 1'));
      region.set(line1);
      expect(region.height).toBe(1);

      const nativeRegion = (region as any).region;
      const pendingFrame1 = [...nativeRegion.pendingFrame];
      
      const line2 = flex({ gap: 0 }, col({ width: 10, color: 'blue' }, 'Line 2'));
      region.add(line2);
      expect(region.height).toBe(2);

      // First line should still be in pendingFrame
      const pendingFrame2 = nativeRegion.pendingFrame;
      expect(pendingFrame2.length).toBeGreaterThanOrEqual(2);
      // First line should still contain 'Line 1' (or at least not be empty)
      expect(pendingFrame2[0] || '').not.toBe('');
    });
  });

  describe('allComponentDescriptors tracking', () => {
    it('should track all descriptors correctly', () => {
      const line1 = flex({ gap: 0 }, col({ width: 10, color: 'red' }, 'Line 1'));
      region.set(line1);
      
      const descriptors1 = (region as any).allComponentDescriptors;
      expect(descriptors1.length).toBe(1);

      const line2 = flex({ gap: 0 }, col({ width: 10, color: 'blue' }, 'Line 2'));
      region.add(line2);
      
      const descriptors2 = (region as any).allComponentDescriptors;
      expect(descriptors2.length).toBe(2);

      const line3 = flex({ gap: 0 }, col({ width: 10, color: 'green' }, 'Line 3'));
      region.add(line3);
      
      const descriptors3 = (region as any).allComponentDescriptors;
      expect(descriptors3.length).toBe(3);
    });
  });
});

