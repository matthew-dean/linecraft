import { describe, it, expect } from 'vitest';
import { diffFrames, type DiffOp } from './diff';

describe('diffFrames', () => {
  describe('identical frames', () => {
    it('should return no_change ops for identical frames', () => {
      const prev = ['line1', 'line2'];
      const curr = ['line1', 'line2'];
      
      const ops = diffFrames(prev, curr);
      
      expect(ops).toHaveLength(2);
      expect(ops[0].type).toBe('no_change');
      expect(ops[1].type).toBe('no_change');
    });
  });

  describe('changed line', () => {
    it('should detect line updates', () => {
      const prev = ['line1', 'line2'];
      const curr = ['line1', 'line2_changed'];
      
      const ops = diffFrames(prev, curr);
      
      expect(ops).toHaveLength(2);
      expect(ops[0].type).toBe('no_change');
      expect(ops[1].type).toBe('update_line');
      if (ops[1].type === 'update_line') {
        expect(ops[1].line).toBe(1);
        expect(ops[1].content).toBe('line2_changed');
      }
    });
  });

  describe('inserted line', () => {
    it('should detect new lines', () => {
      const prev = ['line1'];
      const curr = ['line1', 'line2'];
      
      const ops = diffFrames(prev, curr);
      
      expect(ops).toHaveLength(2);
      expect(ops[0].type).toBe('no_change');
      expect(ops[1].type).toBe('insert_line');
      if (ops[1].type === 'insert_line') {
        expect(ops[1].line).toBe(1);
        expect(ops[1].content).toBe('line2');
      }
    });
  });

  describe('deleted line', () => {
    it('should detect removed lines', () => {
      const prev = ['line1', 'line2'];
      const curr = ['line1'];
      
      const ops = diffFrames(prev, curr);
      
      expect(ops).toHaveLength(2);
      expect(ops[0].type).toBe('no_change');
      expect(ops[1].type).toBe('delete_line');
      if (ops[1].type === 'delete_line') {
        expect(ops[1].line).toBe(1);
      }
    });
  });

  describe('multiple changes', () => {
    it('should handle complex diffs', () => {
      const prev = ['line1', 'line2', 'line3'];
      const curr = ['line1_changed', 'line2', 'line3', 'line4'];
      
      const ops = diffFrames(prev, curr);
      
      expect(ops).toHaveLength(4);
      expect(ops[0].type).toBe('update_line');
      expect(ops[1].type).toBe('no_change');
      expect(ops[2].type).toBe('no_change');
      expect(ops[3].type).toBe('insert_line');
    });
  });

  describe('empty frames', () => {
    it('should handle empty frames', () => {
      const prev: string[] = [];
      const curr: string[] = [];
      
      const ops = diffFrames(prev, curr);
      
      expect(ops).toHaveLength(0);
    });
  });

  describe('completely different frames', () => {
    it('should detect all changes', () => {
      const prev = ['old1', 'old2'];
      const curr = ['new1', 'new2'];
      
      const ops = diffFrames(prev, curr);
      
      expect(ops).toHaveLength(2);
      expect(ops[0].type).toBe('update_line');
      expect(ops[1].type).toBe('update_line');
    });
  });

  describe('edge cases', () => {
    it('should handle prev longer than curr', () => {
      const prev = ['line1', 'line2', 'line3'];
      const curr = ['line1'];
      
      const ops = diffFrames(prev, curr);
      
      expect(ops).toHaveLength(3);
      expect(ops[0].type).toBe('no_change');
      expect(ops[1].type).toBe('delete_line');
      expect(ops[2].type).toBe('delete_line');
    });

    it('should handle curr longer than prev', () => {
      const prev = ['line1'];
      const curr = ['line1', 'line2', 'line3'];
      
      const ops = diffFrames(prev, curr);
      
      expect(ops).toHaveLength(3);
      expect(ops[0].type).toBe('no_change');
      expect(ops[1].type).toBe('insert_line');
      expect(ops[2].type).toBe('insert_line');
    });
  });
});

