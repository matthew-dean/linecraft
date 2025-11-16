import { describe, it, expect, beforeEach } from 'vitest';
import { Flex } from './flex';
import { Col } from '../components/col';
import { MockTerminalRegion } from '../test-helpers/mock-region';
import type { TerminalRegion } from '../region';

describe('Flex - Comprehensive Tests', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    region = new MockTerminalRegion(80, 24) as unknown as TerminalRegion;
  });

  describe('Basic Column Rendering', () => {
    it('should render a single column with content', () => {
      const col = new Col(region, 'Hello');
      col.render(0, 1, 10);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      expect(plain).toBe('Hello     '); // 5 chars + 5 spaces padding
    });

    it('should render a column without content (empty string)', () => {
      const col = new Col(region, '');
      col.render(0, 1, 10);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      expect(plain).toBe('          '); // 10 spaces
    });

    it('should render multiple columns side by side', () => {
      const col1 = new Col(region, 'A');
      const col2 = new Col(region, 'B');
      
      col1.render(0, 1, 5);
      col2.render(5, 1, 5);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      expect(plain).toBe('A    B    '); // A + 4 spaces + B + 4 spaces
    });
  });

  describe('Fixed Width Columns', () => {
    it('should render fixed-width column at exact width', () => {
      const col = new Col(region, 'Hi', { width: 10 });
      col.render(0, 1, 10);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      expect(plain.length).toBe(10);
      expect(plain).toBe('Hi        ');
    });

    it('should render fixed-width column that truncates long content', () => {
      const col = new Col(region, 'This is very long text', { width: 10 });
      col.render(0, 1, 10);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      expect(plain.length).toBe(10);
      // Should truncate with ellipsis: "This is..." (7 chars + 3 dots = 10)
      expect(plain).toMatch(/^This is\.\.\.$/);
    });
  });

  describe('Flex Distribution - Basic', () => {
    it('should distribute space equally with flex=1', () => {
      const flex = new Flex(region, { gap: 0 });
      const col1 = new Col(region, 'A', { flex: 1 });
      const col2 = new Col(region, 'B', { flex: 1 });
      
      flex.addChild(col1);
      flex.addChild(col2);
      
      flex.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      // Both should be visible
      expect(plain).toContain('A');
      expect(plain).toContain('B');
      
      // Should fill the line (approximately)
      expect(plain.length).toBeGreaterThanOrEqual(75);
    });

    it('should respect fixed-width column and fill remaining with flex', () => {
      const flex = new Flex(region, { gap: 0 });
      const fixed = new Col(region, 'Fixed', { width: 20 });
      const flexCol = new Col(region, 'Flex', { flex: 1 });
      
      flex.addChild(fixed);
      flex.addChild(flexCol);
      
      flex.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      // Fixed column should be exactly 20 chars
      const fixedPart = plain.slice(0, 20);
      expect(fixedPart).toContain('Fixed');
      expect(fixedPart.length).toBe(20);
      
      // Flex column should fill the rest
      expect(plain.length).toBe(80);
      expect(plain).toContain('Flex');
    });

    it('should handle multiple fixed columns with one flex column', () => {
      const flex = new Flex(region, { gap: 0 });
      const fixed1 = new Col(region, 'A', { width: 10 });
      const fixed2 = new Col(region, 'B', { width: 15 });
      const flexCol = new Col(region, 'Flex', { flex: 1 });
      
      flex.addChild(fixed1);
      flex.addChild(fixed2);
      flex.addChild(flexCol);
      
      flex.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      expect(plain.length).toBe(80);
      expect(plain.slice(0, 10)).toContain('A');
      expect(plain.slice(10, 25)).toContain('B');
      expect(plain.slice(25)).toContain('Flex');
    });
  });

  describe('Gap Rendering', () => {
    it('should render gap spaces between columns', () => {
      const flex = new Flex(region, { gap: 2 });
      const col1 = new Col(region, 'A', { width: 10 });
      const col2 = new Col(region, 'B', { width: 10 });
      
      flex.addChild(col1);
      flex.addChild(col2);
      
      flex.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      // Should have: A (10) + gap (2) + B (10) = 22 chars
      expect(plain.length).toBeGreaterThanOrEqual(22);
      
      // Check gap is present (spaces between columns)
      const col1End = plain.indexOf('A') + 10;
      const col2Start = plain.indexOf('B');
      const gap = col2Start - col1End;
      expect(gap).toBe(2);
    });

    it('should account for gap in available space calculation', () => {
      const flex = new Flex(region, { gap: 5 });
      const col1 = new Col(region, 'A', { width: 10 });
      const flexCol = new Col(region, 'Flex', { flex: 1 });
      
      flex.addChild(col1);
      flex.addChild(flexCol);
      
      flex.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      // Total: 80
      // col1: 10
      // gap: 5
      // flexCol: 80 - 10 - 5 = 65
      expect(plain.length).toBe(80);
      
      const col1End = plain.indexOf('A') + 10;
      const flexStart = plain.indexOf('Flex');
      const gap = flexStart - col1End;
      expect(gap).toBe(5);
    });

    it('should not render gap after last column', () => {
      const flex = new Flex(region, { gap: 3 });
      const col1 = new Col(region, 'A', { width: 10 });
      const col2 = new Col(region, 'B', { width: 10 });
      
      flex.addChild(col1);
      flex.addChild(col2);
      
      flex.render(0, 1, 30);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      // Should be: A (10) + gap (3) + B (10) = 23, not 26
      const col1End = plain.indexOf('A') + 10;
      const col2Start = plain.indexOf('B');
      const gap = col2Start - col1End;
      expect(gap).toBe(3);
      
      // No gap after B
      const col2End = col2Start + 10;
      expect(plain.length).toBeLessThanOrEqual(col2End + 1); // Allow for padding
    });
  });

  describe('Flex Ratios', () => {
    it('should distribute space proportionally with flex ratios', () => {
      const flex = new Flex(region, { gap: 0 });
      const col1 = new Col(region, 'A', { flex: 1 });
      const col2 = new Col(region, 'B', { flex: 2 });
      
      flex.addChild(col1);
      flex.addChild(col2);
      
      flex.render(0, 1, 90);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      // Total flex: 3
      // col1 gets: 1/3 of available space
      // col2 gets: 2/3 of available space
      const col1Start = plain.indexOf('A');
      const col2Start = plain.indexOf('B');
      const col1Width = col2Start - col1Start;
      const col2Width = plain.length - col2Start;
      
      // col2 should be approximately 2x col1
      expect(col2Width).toBeGreaterThan(col1Width);
      expect(col2Width / col1Width).toBeCloseTo(2, 0);
    });

    it('should handle flex=0 (no growth)', () => {
      const flex = new Flex(region, { gap: 0 });
      const fixed = new Col(region, 'Fixed', { flex: 0 });
      const flexCol = new Col(region, 'Grows', { flex: 1 });
      
      flex.addChild(fixed);
      flex.addChild(flexCol);
      
      flex.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      // Fixed should stay at content width (5)
      const fixedStart = plain.indexOf('Fixed');
      const flexStart = plain.indexOf('Grows');
      const fixedWidth = flexStart - fixedStart;
      
      expect(fixedWidth).toBe(5); // "Fixed".length
      expect(plain.length).toBe(80); // Flex fills the rest
    });
  });

  describe('Min/Max Constraints', () => {
    it('should respect minWidth constraint', () => {
      const flex = new Flex(region, { gap: 0 });
      const col1 = new Col(region, 'A', { flex: 1, min: 30 });
      const col2 = new Col(region, 'B', { flex: 1 });
      
      flex.addChild(col1);
      flex.addChild(col2);
      
      flex.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      const col1Start = plain.indexOf('A');
      const col2Start = plain.indexOf('B');
      const col1Width = col2Start - col1Start;
      
      // col1 should be at least 30
      expect(col1Width).toBeGreaterThanOrEqual(30);
    });

    it('should respect maxWidth constraint', () => {
      const flex = new Flex(region, { gap: 0 });
      const col1 = new Col(region, 'A', { flex: 1, max: 20 });
      const col2 = new Col(region, 'B', { flex: 1 });
      
      flex.addChild(col1);
      flex.addChild(col2);
      
      flex.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      const col1Start = plain.indexOf('A');
      const col2Start = plain.indexOf('B');
      const col1Width = col2Start - col1Start;
      
      // col1 should be at most 20
      expect(col1Width).toBeLessThanOrEqual(20);
    });

    it('should handle width (fixed) which sets both min and max', () => {
      const flex = new Flex(region, { gap: 0 });
      const fixed = new Col(region, 'Fixed', { width: 25 });
      const flexCol = new Col(region, 'Flex', { flex: 1 });
      
      flex.addChild(fixed);
      flex.addChild(flexCol);
      
      flex.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      const fixedStart = plain.indexOf('Fixed');
      const flexStart = plain.indexOf('Flex');
      const fixedWidth = flexStart - fixedStart;
      
      // Fixed should be exactly 25
      expect(fixedWidth).toBe(25);
      // Flex should fill the rest: 80 - 25 = 55
      expect(plain.length - flexStart).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Nested Flex Components', () => {
    it('should handle flex component as child of flex', () => {
      const outerFlex = new Flex(region, { gap: 0 });
      const innerFlex = new Flex(region, { gap: 0 });
      
      const col1 = new Col(region, 'A', { width: 10 });
      const col2 = new Col(region, 'B', { width: 10 });
      innerFlex.addChild(col1);
      innerFlex.addChild(col2);
      
      const col3 = new Col(region, 'C', { flex: 1 });
      outerFlex.addChild(innerFlex);
      outerFlex.addChild(col3);
      
      outerFlex.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      // Should have A, B, and C
      expect(plain).toContain('A');
      expect(plain).toContain('B');
      expect(plain).toContain('C');
      
      // Inner flex (A+B) should take ~20, C should fill the rest
      expect(plain.length).toBe(80);
    });

    it('should handle nested flex with flex children', () => {
      const outerFlex = new Flex(region, { gap: 0 });
      const innerFlex = new Flex(region, { gap: 0, flex: 1 });
      
      const col1 = new Col(region, 'A', { flex: 1 });
      const col2 = new Col(region, 'B', { flex: 1 });
      innerFlex.addChild(col1);
      innerFlex.addChild(col2);
      
      const col3 = new Col(region, 'C', { width: 20 });
      outerFlex.addChild(innerFlex);
      outerFlex.addChild(col3);
      
      outerFlex.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      expect(plain).toContain('A');
      expect(plain).toContain('B');
      expect(plain).toContain('C');
      
      // Inner flex should fill most space, C should be 20
      const cStart = plain.indexOf('C');
      const cWidth = plain.length - cStart;
      expect(cWidth).toBeGreaterThanOrEqual(18); // Allow for padding
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty flex (no children)', () => {
      const flex = new Flex(region, { gap: 0 });
      flex.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      expect(plain).toBe('');
    });

    it('should handle single child in flex', () => {
      const flex = new Flex(region, { gap: 0 });
      const col = new Col(region, 'Only', { flex: 1 });
      flex.addChild(col);
      
      flex.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      expect(plain).toContain('Only');
      expect(plain.length).toBe(80);
    });

    it('should handle very narrow container', () => {
      const flex = new Flex(region, { gap: 0 });
      const col1 = new Col(region, 'A', { width: 5 });
      const col2 = new Col(region, 'B', { flex: 1 });
      flex.addChild(col1);
      flex.addChild(col2);
      
      flex.render(0, 1, 10);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      expect(plain.length).toBe(10);
      expect(plain).toContain('A');
      expect(plain).toContain('B');
    });

    it('should handle columns that exceed container width due to min constraints', () => {
      const flex = new Flex(region, { gap: 0 });
      const col1 = new Col(region, 'A', { min: 50 });
      const col2 = new Col(region, 'B', { min: 50 });
      flex.addChild(col1);
      flex.addChild(col2);
      
      flex.render(0, 1, 80);
      
      const line = region.getLine(1);
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      
      // Should still render, even if it exceeds (min constraints take priority)
      expect(plain).toContain('A');
      expect(plain).toContain('B');
    });
  });

  describe('Resize Behavior', () => {
    it('should adapt flex columns when container width changes', () => {
      const flex = new Flex(region, { gap: 0 });
      const fixed = new Col(region, 'Fixed', { width: 20 });
      const flexCol = new Col(region, 'Flex', { flex: 1 });
      flex.addChild(fixed);
      flex.addChild(flexCol);
      
      // Render at width 80
      flex.render(0, 1, 80);
      const line80 = region.getLine(1);
      const plain80 = line80.replace(/\x1b\[[0-9;]*m/g, '');
      const flexWidth80 = plain80.length - plain80.indexOf('Flex') - 4; // "Flex".length
      
      // Clear and render at width 40
      region.clear();
      flex.render(0, 1, 40);
      const line40 = region.getLine(1);
      const plain40 = line40.replace(/\x1b\[[0-9;]*m/g, '');
      const flexWidth40 = plain40.length - plain40.indexOf('Flex') - 4;
      
      // Flex column should be smaller at 40 than at 80
      expect(flexWidth40).toBeLessThan(flexWidth80);
      
      // Fixed should stay the same
      expect(plain40.indexOf('Fixed')).toBe(plain80.indexOf('Fixed'));
    });
  });
});

