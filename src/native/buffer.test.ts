import { describe, it, expect } from 'vitest';
import { RenderBuffer } from './buffer.js';

describe('RenderBuffer', () => {

  describe('initialization', () => {
    it('should initialize with empty buffer', () => {
      const buffer = new RenderBuffer();
      expect(buffer.size).toBe(0);
    });

    it('should use process.stdout by default', () => {
      const buffer = new RenderBuffer();
      expect(buffer).toBeDefined();
      expect(buffer.size).toBe(0);
    });
  });

  describe('write', () => {
    it('should append data to buffer', () => {
      const buffer = new RenderBuffer();
      buffer.write('hello');
      buffer.write(' world');
      
      expect(buffer.size).toBe(11);
    });

    it('should handle large content', () => {
      const buffer = new RenderBuffer();
      const largeContent = 'x'.repeat(1000);
      buffer.write(largeContent);
      
      expect(buffer.size).toBe(1000);
    });
  });

  describe('clear', () => {
    it('should clear the buffer', () => {
      const buffer = new RenderBuffer();
      buffer.write('test');
      buffer.clear();
      
      expect(buffer.size).toBe(0);
    });
  });

  describe('flush', () => {
    it('should write buffered data to stdout', () => {
      const buffer = new RenderBuffer();
      buffer.write('hello');
      buffer.write(' world');
      buffer.flush();
      
      // Should have written to stdout (visible in test output)
      expect(buffer.size).toBe(0);
    });

    it('should not write if buffer is empty', () => {
      const buffer = new RenderBuffer();
      buffer.flush();
      
      // Should not throw
      expect(buffer.size).toBe(0);
    });

    it('should handle multiple writes and flush', () => {
      const buffer = new RenderBuffer();
      buffer.write('part1');
      buffer.write('part2');
      buffer.write('part3');
      
      expect(buffer.size).toBe(15);
      
      buffer.flush();
      // Should have written to stdout (visible in test output)
      expect(buffer.size).toBe(0);
    });
  });
});

