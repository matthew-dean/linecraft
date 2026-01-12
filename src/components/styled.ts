// Style component for text styling and overflow handling

import type { RenderContext, Component } from '../component.js';
import { callComponent } from '../component.js';
import type { Color } from '../types.js';
import { applyStyle } from '../utils/colors.js';
import { truncateEnd, truncateStart, truncateMiddle, wrapText } from '../utils/text.js';

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
 * Styled component - applies styling and handles overflow
 */
export function Styled(
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
      const result = callComponent(content, ctx);
      if (result === null) return null;
      text = result;
    }
    
    // Handle overflow
    const overflow = options.overflow ?? 'wrap';
    const availableWidth = Math.max(0, ctx.availableWidth);
    const alignMode = options.align ?? 'left';
    const styleOptions = {
      color: options.color,
      backgroundColor: options.backgroundColor,
      bold: options.bold,
      italic: options.italic,
      underline: options.underline,
    };

    const formatLines = (lines: string[]): string | string[] => {
      if (lines.length === 0) {
        lines.push('');
      }
      const formatted = lines.map(line => {
        const aligned = alignText(line, availableWidth, alignMode);
        // Check if the line already has ANSI codes - if so, preserve them
        const hasAnsiCodes = /\x1b\[[0-9;]*m/.test(aligned);
        if (hasAnsiCodes) {
          // Text already has styling - don't overwrite it, just return as-is
          return aligned;
        }
        // No existing ANSI codes - apply the style options
        return applyStyle(aligned, styleOptions);
      });
      return formatted.length === 1 ? formatted[0] : formatted;
    };

    if (availableWidth === 0) {
      return formatLines(['']);
    }
    
    if (typeof text === 'string') {
      // Single line
      let processed = text;
      
      if (overflow === 'ellipsis-end' && processed.length > availableWidth) {
        processed = truncateEnd(processed, availableWidth);
      } else if (overflow === 'ellipsis-start' && processed.length > availableWidth) {
        processed = truncateStart(processed, availableWidth);
      } else if (overflow === 'ellipsis-middle' && processed.length > availableWidth) {
        processed = truncateMiddle(processed, availableWidth);
      } else if (overflow === 'wrap' || overflow === 'none') {
        const wrapped = wrapText(processed, availableWidth);
        return formatLines(wrapped);
      }
      
      // Apply alignment
      const aligned = alignText(processed, availableWidth, alignMode);
      // Check if the line already has ANSI codes - if so, preserve them
      const hasAnsiCodes = /\x1b\[[0-9;]*m/.test(aligned);
      if (hasAnsiCodes) {
        // Text already has styling - don't overwrite it, just return as-is
        return aligned;
      }
      // No existing ANSI codes - apply the style options
      return applyStyle(aligned, styleOptions);
    } else {
      // Array of strings - apply styling and alignment to each line
      const lines: string[] = [];
      for (const line of text) {
        // Check if line already has ANSI codes
        const hasAnsiCodes = /\x1b\[[0-9;]*m/.test(line);
        if (hasAnsiCodes) {
          // Already styled - wrap it preserving ANSI codes
          const wrapped = wrapText(line, availableWidth);
          lines.push(...wrapped);
        } else {
          // No ANSI codes - wrap and will be styled later
          const wrapped = wrapText(line, availableWidth);
          lines.push(...wrapped);
        }
      }
      return formatLines(lines);
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
  if (!Number.isFinite(width)) {
    return text;
  }
  
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

