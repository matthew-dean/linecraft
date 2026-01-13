// Unit tests for text utilities

import { describe, it, expect } from 'vitest';
import { truncateToWidth, truncateStart, truncateEnd, truncateMiddle, truncateFocusRange, mapColumnToDisplay, countVisibleChars, stripAnsi, splitAtVisiblePos } from './text.js';
import { applyStyle } from './colors.js';

describe('text utilities', () => {
  describe('truncateToWidth', () => {
    it('should preserve ANSI codes when truncating', () => {
      const text = applyStyle('Hello World', { color: 'red' });
      const result = truncateToWidth(text, 8);
      const plain = stripAnsi(result);
      expect(plain).toBe('Hello Wo');
      expect(result).toContain('\x1b['); // Should contain ANSI codes
    });

    it('should close OSC 8 hyperlinks when truncating', () => {
      const text = '\x1b]8;;file:///test\x1b\\Hello World\x1b]8;;\x1b\\';
      const result = truncateToWidth(text, 8);
      expect(result).toContain('\x1b]8;;\x1b\\'); // Should close hyperlink
      const plain = stripAnsi(result);
      expect(plain.length).toBeLessThanOrEqual(8);
    });
  });

  describe('truncateEnd', () => {
    it('should add ellipsis and preserve ANSI codes', () => {
      const text = applyStyle('Hello World', { color: 'red' });
      const result = truncateEnd(text, 8);
      const plain = stripAnsi(result);
      expect(plain).toMatch(/\.\.\.$/);
      expect(plain.length).toBeLessThanOrEqual(8);
    });
  });

  describe('truncateStart', () => {
    it('should add ellipsis at start and preserve ANSI codes', () => {
      const text = applyStyle('Hello World', { color: 'red' });
      const result = truncateStart(text, 8);
      const plain = stripAnsi(result);
      expect(plain).toMatch(/^\.\.\./);
      expect(plain.length).toBeLessThanOrEqual(8);
      // Should preserve color on remaining text
      expect(result).toContain('\x1b[');
    });
  });

  describe('truncateMiddle', () => {
    it('should add ellipsis in middle and preserve ANSI codes', () => {
      const text = applyStyle('Hello World', { color: 'red' });
      const result = truncateMiddle(text, 8);
      const plain = stripAnsi(result);
      expect(plain).toContain('...');
      expect(plain.length).toBeLessThanOrEqual(8);
      // Should preserve color on both parts
      expect(result).toContain('\x1b[');
    });
  });

  describe('splitAtVisiblePos', () => {
    it('should split text and preserve ANSI codes', () => {
      const text = applyStyle('Hello World', { color: 'red' });
      const { before, after } = splitAtVisiblePos(text, 5);
      const beforePlain = stripAnsi(before);
      const afterPlain = stripAnsi(after);
      expect(beforePlain).toBe('Hello');
      expect(afterPlain).toBe(' World');
      // Both parts should have ANSI codes
      expect(before).toContain('\x1b[');
      expect(after).toContain('\x1b[');
    });

    it('should not lose characters when splitting', () => {
      const text = 'console.log(hello world")';
      const { before, after } = splitAtVisiblePos(text, 12);
      const combined = stripAnsi(before) + stripAnsi(after);
      expect(combined).toBe(text);
    });
  });

  describe('countVisibleChars', () => {
    it('should count only visible characters, ignoring ANSI codes', () => {
      const text = applyStyle('Hello', { color: 'red' });
      expect(countVisibleChars(text)).toBe(5);
    });

    it('should handle OSC 8 hyperlinks', () => {
      const text = '\x1b]8;;file:///test\x1b\\Hello\x1b]8;;\x1b\\';
      expect(countVisibleChars(text)).toBe(5);
    });
  });

  describe('truncateFocusRange', () => {
    it('should return visible range information', () => {
      const text = 'console.log("hello world");';
      const result = truncateFocusRange(text, 20, 1, 11);
      expect(result.text).toBeTruthy();
      expect(result.visibleStartCol).toBeGreaterThan(0);
      expect(result.visibleEndCol).toBeGreaterThanOrEqual(result.visibleStartCol);
    });

    it('should correctly show target range when code overflows', () => {
      // Simulate the failing case: long line with target at the end
      const longLine = '@media (tv) { .a,.b,.c,.d,.e,.f,.g,.h,.i,.j,.k,.l,.m,.n,.o,.p,.q,.r,.s,.t,.u,.v) {};';
      // Target is .v which is near the end (around column 77)
      const targetCol = 77;
      const result = truncateFocusRange(longLine, 50, targetCol, targetCol);
      
      // The visible range should include the target column
      expect(result.visibleEndCol).toBeGreaterThanOrEqual(targetCol);
      expect(result.visibleStartCol).toBeLessThanOrEqual(targetCol);
      
      // The truncated text should contain the target character
      const truncatedPlain = stripAnsi(result.text);
      expect(truncatedPlain).toContain('.v');
    });
  });

  describe('mapColumnToDisplay', () => {
    it('should correctly map columns when code fits', () => {
      const originalText = 'console.log("hello");';
      const truncatedText = originalText;
      const displayPos = mapColumnToDisplay(originalText, truncatedText, 1, originalText.length, 12);
      expect(displayPos).toBe(12);
    });

    it('should correctly map columns with ellipsis at start', () => {
      const originalText = 'console.log("hello world");';
      const truncatedText = '...log("hello world");';
      // If visible range starts at column 10, column 12 should map correctly
      const displayPos = mapColumnToDisplay(originalText, truncatedText, 10, 25, 12);
      // Column 12 in original should be at position 3 (ellipsis) + (12 - 10 + 1) = 6
      expect(displayPos).toBe(6);
    });

    it('should correctly map columns with ellipsis at end', () => {
      const originalText = 'console.log("hello world");';
      const truncatedText = 'console.log("hello...';
      // If visible range is 1-15, column 12 should map correctly
      const displayPos = mapColumnToDisplay(originalText, truncatedText, 1, 15, 12);
      expect(displayPos).toBe(12);
    });

    it('should correctly map target column when code overflows (failing case)', () => {
      // This is the specific failing case from the user
      const longLine = '@media (tv) { .a,.b,.c,.d,.e,.f,.g,.h,.i,.j,.k,.l,.m,.n,.o,.p,.q,.r,.s,.t,.u,.v) {};';
      const targetCol = 77; // .v is at column 77
      
      // Truncate to show the target
      const result = truncateFocusRange(longLine, 50, targetCol, targetCol);
      
      // Map the target column to display position
      const displayPos = mapColumnToDisplay(
        longLine,
        result.text,
        result.visibleStartCol,
        result.visibleEndCol,
        targetCol
      );
      
      // The display position should point to where .v appears in the truncated text
      const truncatedPlain = stripAnsi(result.text);
      const expectedChar = longLine[targetCol - 1]; // -1 because columns are 1-based
      const actualChar = truncatedPlain[displayPos - 1]; // -1 because positions are 1-based
      
      expect(actualChar).toBe(expectedChar);
    });

    it('should correctly map columns with start ellipsis (real-world code-debug case)', () => {
      // Simulate a long line that gets truncated with ellipsis at start
      // Original: "  .ma:extend(.a,.b,.c,.d,.e,.f,.g,.h,.i,.j,.k,.l,.m,.n,.o,.p,.q,.r,.s,.t,.u,.v) {};"
      // Truncated: "...b,.c,.d,.e,.f,.g,.h,.i,.j,.k,.l,.m,.n,.o,.p,.q,.r,.s,.t,.u,.v) {};"
      const originalLine = '  .ma:extend(.a,.b,.c,.d,.e,.f,.g,.h,.i,.j,.k,.l,.m,.n,.o,.p,.q,.r,.s,.t,.u,.v) {};';
      const startCol = 77; // Column 77 is '.v'
      const endCol = 78; // Column 78 is ')'
      
      // Truncate to show columns around 77-78
      const result = truncateFocusRange(originalLine, 50, startCol, endCol);
      
      // Map both columns
      const displayStart = mapColumnToDisplay(originalLine, result.text, result.visibleStartCol, result.visibleEndCol, startCol, result.rangeStartCol, result.rangeEndCol);
      const displayEnd = mapColumnToDisplay(originalLine, result.text, result.visibleStartCol, result.visibleEndCol, endCol, result.rangeStartCol, result.rangeEndCol);
      
      // Verify the mapped positions point to the correct characters
      const truncatedPlain = stripAnsi(result.text);
      const expectedStartChar = originalLine[startCol - 1]; // '.v' at position 77
      const expectedEndChar = originalLine[endCol - 1]; // ')' at position 78
      
      const actualStartChar = truncatedPlain[displayStart - 1];
      const actualEndChar = truncatedPlain[displayEnd - 1];
      
      expect(actualStartChar).toBe(expectedStartChar);
      expect(actualEndChar).toBe(expectedEndChar);
      
      // Also verify the positions are correct relative to each other
      expect(displayEnd - displayStart).toBe(endCol - startCol);
    });

    it('should correctly map columns when visible range is at the end of a long line', () => {
      // Test case where target is near the end and we have start ellipsis
      const longLine = 'a'.repeat(20) + 'b'.repeat(20) + 'c'.repeat(20) + 'TARGET' + 'd'.repeat(20);
      const targetStart = 61; // Start of "TARGET"
      const targetEnd = 66; // End of "TARGET"
      
      const result = truncateFocusRange(longLine, 30, targetStart, targetEnd);
      
      const displayStart = mapColumnToDisplay(longLine, result.text, result.visibleStartCol, result.visibleEndCol, targetStart, result.rangeStartCol, result.rangeEndCol);
      const displayEnd = mapColumnToDisplay(longLine, result.text, result.visibleStartCol, result.visibleEndCol, targetEnd, result.rangeStartCol, result.rangeEndCol);
      
      const truncatedPlain = stripAnsi(result.text);
      expect(truncatedPlain[displayStart - 1]).toBe('T');
      expect(truncatedPlain[displayEnd - 1]).toBe('T'); // Last char of "TARGET"
      expect(displayEnd - displayStart).toBe(5); // "TARGET" is 5 chars
    });

    it('should correctly map .v at columns 77-78 in real-world Less code example', () => {
      // Real-world test case from code-debug component
      const errorLine = '  .ma:extend(.a,.b,.c,.d,.e,.f,.g,.h,.i,.j,.k,.l,.m,.n,.o,.p,.q,.r,.s,.t,.u,.v) {};';
      const startColumn = 77; // Should point to '.v'
      const endColumn = 78; // Should point to 'v'
      
      // Verify the original columns are correct
      expect(errorLine[startColumn - 1]).toBe('.');
      expect(errorLine[endColumn - 1]).toBe('v');
      
      // Test with different widths to ensure mapping is correct
      const widths = [30, 40, 50, 60, 70, 80, 90, 100];
      
      for (const width of widths) {
        const result = truncateFocusRange(errorLine, width, startColumn, endColumn);
        
        // Map the columns to display positions
        const displayStart = mapColumnToDisplay(
          errorLine,
          result.text,
          result.visibleStartCol,
          result.visibleEndCol,
          startColumn,
          result.rangeStartCol,
          result.rangeEndCol
        );
        const displayEnd = mapColumnToDisplay(
          errorLine,
          result.text,
          result.visibleStartCol,
          result.visibleEndCol,
          endColumn,
          result.rangeStartCol,
          result.rangeEndCol
        );
        
        // Verify the mapped positions point to the correct characters
        const truncatedPlain = stripAnsi(result.text);
        const actualStartChar = truncatedPlain[displayStart - 1];
        const actualEndChar = truncatedPlain[displayEnd - 1];
        
        expect(actualStartChar).toBe('.');
        expect(actualEndChar).toBe('v');
        expect(displayEnd - displayStart).toBe(1); // Should be exactly 1 character apart
        
        // Also verify the visible range includes the target
        expect(result.visibleStartCol).toBeLessThanOrEqual(startColumn);
        expect(result.visibleEndCol).toBeGreaterThanOrEqual(endColumn);
      }
    });

    it('should correctly highlight .v at columns 77-78 when simulating code-debug highlighting', () => {
      // Simulate the exact highlighting logic used in code-debug component
      const errorLine = '  .ma:extend(.a,.b,.c,.d,.e,.f,.g,.h,.i,.j,.k,.l,.m,.n,.o,.p,.q,.r,.s,.t,.u,.v) {};';
      const startColumn = 77;
      const endColumn = 78;
      
      // Test with different widths
      const widths = [30, 40, 50, 60, 70, 80, 90, 100];
      
      for (const width of widths) {
        // Step 1: Truncate (as code-debug does)
        const truncateResult = truncateFocusRange(errorLine, width, startColumn, endColumn);
        const truncatedErrorLine = truncateResult.text;
        const visibleStartCol = truncateResult.visibleStartCol;
        const visibleEndCol = truncateResult.visibleEndCol;
        
        // Step 2: Map columns (as code-debug does)
        const mapColumnToDisplayLocal = (originalCol: number): number => {
          return mapColumnToDisplay(
            errorLine,
            truncatedErrorLine,
            visibleStartCol,
            visibleEndCol,
            originalCol,
            truncateResult.rangeStartCol,
            truncateResult.rangeEndCol
          );
        };
        
        const highlightStart = mapColumnToDisplayLocal(startColumn);
        const highlightEnd = mapColumnToDisplayLocal(endColumn);
        
        // Step 3: Split and extract highlight range (as code-debug does)
        const { before: beforeHighlight, after: remainingAfterStart } = splitAtVisiblePos(truncatedErrorLine, highlightStart - 1);
        const highlightLength = highlightEnd - highlightStart + 1;
        const { before: highlightRange } = splitAtVisiblePos(remainingAfterStart, highlightLength);
        
        // Step 4: Verify the highlighted range contains .v
        const highlightPlain = stripAnsi(highlightRange);
        expect(highlightPlain).toContain('.v');
        
        // Step 5: Verify the exact characters
        const truncatedPlain = stripAnsi(truncatedErrorLine);
        expect(truncatedPlain[highlightStart - 1]).toBe('.');
        expect(truncatedPlain[highlightEnd - 1]).toBe('v');
      }
    });
  });
});
