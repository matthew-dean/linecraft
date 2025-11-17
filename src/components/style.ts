// Style component for text styling and overflow handling

import type { RenderContext, Component } from '../layout/grid';
import type { Color } from '../types';
import { applyStyle } from '../utils/colors';
import { truncateEnd, truncateStart, truncateMiddle, wrapText } from '../utils/text';

export interface StyleOptions {
  color?: Color;
  backgroundColor?: Color;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  overflow?: 'none' | 'ellipsis-end' | 'ellipsis-start' | 'ellipsis-middle' | 'wrap';
  when?: (ctx: RenderContext) => boolean;  // Only show if condition is true
}

/**
 * Style component - applies styling and handles overflow
 */
export function style(
  options: StyleOptions,
  content: string | string[] | Component
): Component {
  return (ctx: RenderContext) => {
    // Check when condition
    if (options.when && !options.when(ctx)) {
      return null;
    }
    
    // Get content
    let text: string | string[];
    if (typeof content === 'string' || Array.isArray(content)) {
      text = content;
    } else {
      // It's a component - render it
      const result = content(ctx);
      if (result === null) return null;
      text = result;
    }
    
    // Handle overflow
    const overflow = options.overflow ?? 'none';
    const availableWidth = ctx.availableWidth;
    
    if (typeof text === 'string') {
      // Single line
      let processed = text;
      
      if (overflow === 'ellipsis-end' && processed.length > availableWidth) {
        processed = truncateEnd(processed, availableWidth);
      } else if (overflow === 'ellipsis-start' && processed.length > availableWidth) {
        processed = truncateStart(processed, availableWidth);
      } else if (overflow === 'ellipsis-middle' && processed.length > availableWidth) {
        processed = truncateMiddle(processed, availableWidth);
      } else if (overflow === 'wrap') {
        // Wrap returns array
        const wrapped = wrapText(processed, availableWidth);
        return wrapped.map(line => applyStyle(line, {
          color: options.color,
          backgroundColor: options.backgroundColor,
          bold: options.bold,
          italic: options.italic,
          underline: options.underline,
        }));
      }
      
      // Apply styling
      return applyStyle(processed, {
        color: options.color,
        backgroundColor: options.backgroundColor,
        bold: options.bold,
        italic: options.italic,
        underline: options.underline,
      });
    } else {
      // Array of strings - apply styling to each line
      return text.map(line => applyStyle(line, {
        color: options.color,
        backgroundColor: options.backgroundColor,
        bold: options.bold,
        italic: options.italic,
        underline: options.underline,
      }));
    }
  };
}

