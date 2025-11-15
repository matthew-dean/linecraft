// Color function for text styling

import { applyStyle } from '../utils/colors.js';
import type { Color } from '../types.js';

/**
 * Apply color to text
 */
export function color(colorName: Color, text: string): string {
  return applyStyle(text, { color: colorName });
}

