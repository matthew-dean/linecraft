// Fill component - fills available width with a character

import type { RenderContext, Component } from '../layout/grid';
import type { Color } from '../types';
import { applyStyle } from '../utils/colors';

export interface FillOptions {
  char?: string;  // Character to repeat (default: ' ')
  color?: Color;
  backgroundColor?: Color;
}

/**
 * Fill component - fills the available width with a repeated character
 */
export function fill(options: FillOptions = {}): Component {
  return (ctx: RenderContext) => {
    const char = options.char ?? ' ';
    const availableWidth = ctx.availableWidth;
    
    // During auto column measurement, availableWidth might be Infinity
    // Fill components have no intrinsic width - they fill available space
    // So during measurement, return empty string (0 width contribution)
    if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
      return '';
    }
    
    const fillText = char.repeat(availableWidth);
    
    return applyStyle(fillText, {
      color: options.color,
      backgroundColor: options.backgroundColor,
    });
  };
}

