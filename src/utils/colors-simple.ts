// Simple color formatting API - less markup required

import { applyStyle } from './colors';
import type { Color } from '../types';

/**
 * Simple color formatting using template-like syntax
 * Example: color`Hello ${'world'}.red.bold`
 */
export function color(strings: TemplateStringsArray, ...values: any[]): string {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += String(values[i]);
    }
  }
  return result;
}

/**
 * Create a color formatter function
 * Usage: const red = colorFn('red', { bold: true });
 *        red('Hello') // returns styled text
 */
export function colorFn(color: Color, style?: { bold?: boolean; italic?: boolean; underline?: boolean }): (text: string) => string {
  return (text: string) => applyStyle(text, { color, ...style });
}

/**
 * Pre-defined color formatters for convenience
 */
export const colors = {
  black: (text: string) => applyStyle(text, { color: 'black' }),
  red: (text: string) => applyStyle(text, { color: 'red' }),
  green: (text: string) => applyStyle(text, { color: 'green' }),
  yellow: (text: string) => applyStyle(text, { color: 'yellow' }),
  blue: (text: string) => applyStyle(text, { color: 'blue' }),
  magenta: (text: string) => applyStyle(text, { color: 'magenta' }),
  cyan: (text: string) => applyStyle(text, { color: 'cyan' }),
  white: (text: string) => applyStyle(text, { color: 'white' }),
  brightBlack: (text: string) => applyStyle(text, { color: 'brightBlack' }),
  brightRed: (text: string) => applyStyle(text, { color: 'brightRed' }),
  brightGreen: (text: string) => applyStyle(text, { color: 'brightGreen' }),
  brightYellow: (text: string) => applyStyle(text, { color: 'brightYellow' }),
  brightBlue: (text: string) => applyStyle(text, { color: 'brightBlue' }),
  brightMagenta: (text: string) => applyStyle(text, { color: 'brightMagenta' }),
  brightCyan: (text: string) => applyStyle(text, { color: 'brightCyan' }),
  brightWhite: (text: string) => applyStyle(text, { color: 'brightWhite' }),
  bold: (text: string) => applyStyle(text, { bold: true }),
  dim: (text: string) => applyStyle(text, { color: 'brightBlack' }), // Dim effect
  italic: (text: string) => applyStyle(text, { italic: true }),
  underline: (text: string) => applyStyle(text, { underline: true }),
};

/**
 * Chainable color API
 * Usage: colors.red.bold('Hello') or colors.bold.red('Hello')
 */
type ColorChain = {
  [K in keyof typeof colors]: ColorChain & ((text: string) => string);
};

function createColorChain(): ColorChain {
  const chain = {} as ColorChain;
  
  for (const key in colors) {
    const fn = colors[key as keyof typeof colors];
    (chain as any)[key] = Object.assign((text: string) => fn(text), chain);
  }
  
  return chain;
}

export const c = createColorChain();

