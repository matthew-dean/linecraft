import { describe, it, expect } from 'vitest';
import { applyStyle } from './colors.js';
import type { TextStyle } from '../types.js';

describe('applyStyle', () => {
  it('should return text unchanged when no style is provided', () => {
    const text = 'Hello, World!';
    expect(applyStyle(text)).toBe(text);
    expect(applyStyle(text, undefined)).toBe(text);
  });

  it('should apply foreground color', () => {
    const text = 'Red text';
    const styled = applyStyle(text, { color: 'red' });
    expect(styled).toContain('\x1b[');
    expect(styled).toContain('31'); // ANSI code for red
    expect(styled).toContain('m');
    expect(styled).toContain(text);
    expect(styled).toContain('\x1b[0m'); // Reset
  });

  it('should apply background color', () => {
    const text = 'Blue background';
    const styled = applyStyle(text, { backgroundColor: 'blue' });
    expect(styled).toContain('44'); // ANSI code for blue background
    expect(styled).toContain(text);
  });

  it('should apply bold style', () => {
    const text = 'Bold text';
    const styled = applyStyle(text, { bold: true });
    expect(styled).toContain('1'); // ANSI code for bold
    expect(styled).toContain(text);
  });

  it('should apply italic style', () => {
    const text = 'Italic text';
    const styled = applyStyle(text, { italic: true });
    expect(styled).toContain('3'); // ANSI code for italic
    expect(styled).toContain(text);
  });

  it('should apply underline style', () => {
    const text = 'Underlined text';
    const styled = applyStyle(text, { underline: true });
    expect(styled).toContain('4'); // ANSI code for underline
    expect(styled).toContain(text);
  });

  it('should apply multiple styles', () => {
    const text = 'Styled text';
    const styled = applyStyle(text, {
      color: 'green',
      backgroundColor: 'yellow',
      bold: true,
      italic: true,
      underline: true,
    });
    
    expect(styled).toContain('32'); // green
    expect(styled).toContain('43'); // yellow background
    expect(styled).toContain('1'); // bold
    expect(styled).toContain('3'); // italic
    expect(styled).toContain('4'); // underline
    expect(styled).toContain(text);
    expect(styled).toContain('\x1b[0m'); // Reset at end
  });

  it('should handle all color values', () => {
    const colors: Array<'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white'> = [
      'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
    ];
    
    colors.forEach(color => {
      const styled = applyStyle('test', { color });
      expect(styled).toContain('\x1b[');
      expect(styled).toContain('m');
    });
  });

  it('should handle bright colors', () => {
    const styled = applyStyle('test', { color: 'brightRed' });
    expect(styled).toContain('91'); // ANSI code for bright red
  });

  it('should handle bright background colors', () => {
    const styled = applyStyle('test', { backgroundColor: 'brightBlue' });
    expect(styled).toContain('104'); // ANSI code for bright blue background
  });

  it('should properly format ANSI escape sequences', () => {
    const styled = applyStyle('test', { color: 'red', bold: true });
    // Should be: \x1b[31;1mtest\x1b[0m
    expect(styled).toMatch(/^\x1b\[31;1mtest\x1b\[0m$/);
  });

  it('should reset styles at the end', () => {
    const styled = applyStyle('test', { color: 'blue' });
    expect(styled.endsWith('\x1b[0m')).toBe(true);
  });
});


