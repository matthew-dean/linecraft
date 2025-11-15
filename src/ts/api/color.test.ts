import { describe, it, expect } from 'vitest';
import { color } from './color.js';

describe('color', () => {
  it('should apply red color', () => {
    const result = color('red', 'Hello');
    expect(result).toContain('\x1b[');
    expect(result).toContain('31'); // Red ANSI code
    expect(result).toContain('Hello');
  });

  it('should apply green color', () => {
    const result = color('green', 'Hello');
    expect(result).toContain('32'); // Green ANSI code
  });

  it('should apply blue color', () => {
    const result = color('blue', 'Hello');
    expect(result).toContain('34'); // Blue ANSI code
  });

  it('should reset color at end', () => {
    const result = color('red', 'Hello');
    expect(result).toMatch(/\x1b\[0m$/); // Reset code at end
  });
});

