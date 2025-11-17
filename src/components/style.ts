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
  align?: 'left' | 'right' | 'center';  // Text alignment within available width
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
        return wrapped.map(line => {
          const aligned = alignText(line, availableWidth, options.align ?? 'left');
          return applyStyle(aligned, {
          color: options.color,
          backgroundColor: options.backgroundColor,
          bold: options.bold,
          italic: options.italic,
          underline: options.underline,
          });
        });
      }
      
      // Apply alignment
      const aligned = alignText(processed, availableWidth, options.align ?? 'left');
      
      // Apply styling
      return applyStyle(aligned, {
        color: options.color,
        backgroundColor: options.backgroundColor,
        bold: options.bold,
        italic: options.italic,
        underline: options.underline,
      });
    } else {
      // Array of strings - apply styling and alignment to each line
      return text.map(line => {
        const aligned = alignText(line, availableWidth, options.align ?? 'left');
        return applyStyle(aligned, {
        color: options.color,
        backgroundColor: options.backgroundColor,
        bold: options.bold,
        italic: options.italic,
        underline: options.underline,
        });
      });
    }
  };
}

/**
 * Align text within available width
 */
function alignText(text: string, width: number, align: 'left' | 'right' | 'center'): string {
  // Get plain text length (without ANSI codes)
  const plainText = text.replace(/\x1b\[[0-9;]*m/g, '');
  const textLength = plainText.length;
  
  if (textLength >= width) {
    return text; // No alignment needed if text is already at or exceeds width
  }
  
  const padding = width - textLength;
  
  if (align === 'right') {
    return ' '.repeat(padding) + text;
  } else if (align === 'center') {
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  } else {
    // 'left' - default, no padding needed
    return text + ' '.repeat(padding);
  }
}

