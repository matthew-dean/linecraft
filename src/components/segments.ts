// Segments component - OhMyZsh/Powerline-style colored segments with angled dividers

import type { RenderContext, Component } from '../component.js';
import type { Color } from '../types.js';
import { applyStyle } from '../utils/colors.js';
import { truncateToWidth } from '../utils/text.js';

// Simple border styles - only the ones that look good
export type BorderStyle = 'cap' | 'capHalf' | 'brace' | 'dot' | 'asterisk';

export interface Segment {
  content: string;  // Content (padding added automatically)
  color?: Color;  // Text color (borders use same color)
  borderStyle?: BorderStyle;  // Border style: 'cap' (default), 'capHalf', 'brace', 'dot', 'asterisk'
}

export interface SegmentsOptions {
  segments: Segment[];
}


/**
 * Get border characters for segment decoration
 * Creates borders around segments on default terminal background
 */
function getBorderChars(style: BorderStyle): { left: string; right: string } {
  switch (style) {
    case 'cap':
      // Half-filled circles - the favorite!
      // ◐ (U+25D0) = Circle with left half black
      // ◑ (U+25D1) = Circle with right half black
      return { left: '◐', right: '◑' };
    case 'capHalf':
      // Upper half circles - mirrored to face the text
      // ◖ (U+25D6) = Upper half circle (left)
      // ◗ (U+25D7) = Lower half circle (right, creates mirror effect)
      return { left: '◖', right: '◗' };
    case 'brace':
      // Curly braces - classic and clean
      return { left: '{', right: '}' };
    case 'dot':
      // Small dot/point
      // · (U+00B7) = Middle dot (smaller, lighter)
      return { left: '·', right: '·' };
    case 'asterisk':
      // Asterisk/star points
      // * (U+002A) = Asterisk
      return { left: '*', right: '*' };
  }
}

/**
 * Segments component - renders decorated segments with automatic dividers
 * 
 * Segments are decorated with borders/symbols on the default terminal background,
 * and automatically connected with dash dividers (─). Content is automatically padded.
 * 
 * Simple API:
 * - content: Text content (padding added automatically)
 * - color: Text color (borders use same color)
 * - borderStyle: Border decoration style (default: 'cap')
 * 
 * Border styles: 'cap' (default), 'capHalf', 'brace', 'dot', 'asterisk'
 */
export function Segments(options: SegmentsOptions): Component {
  return (ctx: RenderContext) => {
    const { segments } = options;
    if (segments.length === 0) {
      return '';
    }

    const availableWidth = ctx.availableWidth;
    let result = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      // Left divider (automatic - dash for middle segments)
      if (i > 0) {
        // Always use dash (─) for dividers - it works well with all border styles
        const dividerColor = 'brightBlack';
        const styledDivider = applyStyle('─', { color: dividerColor });
        result += styledDivider;
      }

      // Left border decoration
      const borderStyle = segment.borderStyle ?? 'cap';
      const borderChars = getBorderChars(borderStyle);
      if (borderChars.left) {
        // Auto-theme: borders use text color
        const borderColor = segment.color ?? 'brightCyan';
        result += applyStyle(borderChars.left, { color: borderColor });
      }

      // Segment content with automatic padding (no background, just text color)
      // Trim content and add padding automatically
      const trimmedContent = segment.content.trim();
      const paddedContent = ` ${trimmedContent} `;
      const styledContent = applyStyle(paddedContent, {
        color: segment.color,
        // No backgroundColor - uses default terminal background
      });
      result += styledContent;

      // Right border decoration
      if (borderChars.right) {
        // Auto-theme: borders use text color
        const borderColor = segment.color ?? 'brightCyan';
        result += applyStyle(borderChars.right, { color: borderColor });
      }

      // Right divider (automatic - dash for middle segments)
      if (i < segments.length - 1) {
        // Always use dash (─) for dividers - it works well with all border styles
        const dividerColor = 'brightBlack';
        const styledDivider = applyStyle('─', { color: dividerColor });
        result += styledDivider;
      }
    }

    // Truncate if needed (preserving ANSI codes)
    return truncateToWidth(result, availableWidth);
  };
}

