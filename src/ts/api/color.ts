// Color function for text styling

import { applyStyle } from '../utils/colors';
import type { Color } from '../types';

/**
 * Apply color to text
 */
export function color(colorName: Color, text: string): string {
  return applyStyle(text, { color: colorName });
}

