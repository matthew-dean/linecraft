import { describe, it, expect } from 'vitest';
import * as ansi from './ansi.js';

describe('ANSI', () => {
  describe('moveCursorTo', () => {
    it('should generate correct ANSI for cursor position', () => {
      const seq = ansi.moveCursorTo(10, 5);
      expect(seq).toBe('\x1b[5;10H');
    });

    it('should handle zero coordinates', () => {
      const seq = ansi.moveCursorTo(0, 0);
      expect(seq).toBe('\x1b[0;0H');
    });

    it('should handle large coordinates', () => {
      const seq = ansi.moveCursorTo(200, 100);
      expect(seq).toBe('\x1b[100;200H');
    });
  });

  describe('moveCursorUp', () => {
    it('should generate correct ANSI for moving up', () => {
      const seq = ansi.moveCursorUp(3);
      expect(seq).toBe('\x1b[3A');
    });

    it('should handle zero', () => {
      const seq = ansi.moveCursorUp(0);
      expect(seq).toBe('\x1b[0A');
    });
  });

  describe('moveCursorDown', () => {
    it('should generate correct ANSI for moving down', () => {
      const seq = ansi.moveCursorDown(2);
      expect(seq).toBe('\x1b[2B');
    });
  });

  describe('moveCursorRight', () => {
    it('should generate correct ANSI for moving right', () => {
      const seq = ansi.moveCursorRight(5);
      expect(seq).toBe('\x1b[5C');
    });
  });

  describe('moveCursorLeft', () => {
    it('should generate correct ANSI for moving left', () => {
      const seq = ansi.moveCursorLeft(3);
      expect(seq).toBe('\x1b[3D');
    });
  });

  describe('constants', () => {
    it('should have correct ANSI constants', () => {
      expect(ansi.CLEAR_LINE).toBe('\x1b[2K');
      expect(ansi.HIDE_CURSOR).toBe('\x1b[?25l');
      expect(ansi.SHOW_CURSOR).toBe('\x1b[?25h');
      expect(ansi.SAVE_CURSOR).toBe('\x1b[s');
      expect(ansi.RESTORE_CURSOR).toBe('\x1b[u');
      expect(ansi.RESET).toBe('\x1b[0m');
    });
  });
});

