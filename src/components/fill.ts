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
    
    const fillText = char.repeat(availableWidth);
    
    return applyStyle(fillText, {
      color: options.color,
      backgroundColor: options.backgroundColor,
    });
  };
}

