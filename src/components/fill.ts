// Fill component - fills available width with a character

import type { RenderContext, Component } from '../component.js';
import type { Color, FillChar } from '../types.js';
import { applyStyle } from '../utils/colors.js';

export interface FillOptions {
  backgroundColor?: Color;
}

/**
 * Normalize FillChar to { char, color } format
 */
function normalizeFillChar(fillChar: FillChar): { char: string; color?: Color } {
  if (typeof fillChar === 'string') {
    return { char: fillChar };
  }
  return fillChar;
}

/**
 * Fill component - fills the available width with a repeated character
 * 
 * Usage:
 *   fill('─')                                    // Simple character
 *   fill({ char: '─', color: 'red' })           // Character with color
 *   fill('─', { backgroundColor: 'blue' })      // Character with additional options
 */
export function fill(
  fillChar: FillChar = ' ',
  options: FillOptions = {}
): Component {
  return (ctx: RenderContext) => {
    const { char, color } = normalizeFillChar(fillChar);
    const availableWidth = ctx.availableWidth;
    
    // During auto column measurement, availableWidth might be Infinity
    // Fill components have no intrinsic width - they fill available space
    // So during measurement, return empty string (0 width contribution)
    if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
      return '';
    }
    
    const fillText = char.repeat(availableWidth);
    
    return applyStyle(fillText, {
      color,
      backgroundColor: options.backgroundColor,
    });
  };
}

