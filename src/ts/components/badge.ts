// Badge component - colored label with optional icon

import type { TerminalRegion } from '../region';
import type { Renderable } from './renderable';
import { color } from '../api/color';
import { Col } from './col';

export interface BadgeOptions {
  text: string;
  bgColor?: string;
  textColor?: string;
  icon?: string;
  padding?: number;
}

/**
 * Create a badge component (colored label)
 */
export function createBadge(
  region: TerminalRegion,
  options: BadgeOptions
): Renderable {
  const {
    text,
    bgColor,
    textColor = 'white',
    icon = '',
    padding = 1,
  } = options;

  const iconText = icon ? icon + ' ' : '';
  const content = iconText + text;
  const contentWidth = content.length;
  const totalWidth = contentWidth + padding * 2;

  // Build styled text
  let styledText = content;
  if (textColor) {
    styledText = color(textColor, styledText);
  }
  if (bgColor) {
    styledText = color(bgColor, styledText);
  }

  return {
    flexGrow: 0,
    flexShrink: 1,
    
    getPreferredWidth(): number {
      return totalWidth;
    },
    
    getMinWidth(): number {
      return totalWidth;
    },
    
    getMaxWidth(): number {
      return totalWidth;
    },
    
    getHeight(): number {
      return 1;
    },
    
    render(x: number, y: number, width: number): void {
      // Pad with spaces
      const padded = ' '.repeat(padding) + styledText + ' '.repeat(padding);
      const truncated = padded.substring(0, width);
      
      // Get existing line and merge
      const existingLine = region.getLine(y) || '';
      const before = existingLine.slice(0, x);
      const after = existingLine.slice(x + width);
      region.setLine(y, before + truncated.padEnd(width, ' ') + after);
    },
  };
}

