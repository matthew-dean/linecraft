// Divider component - horizontal line with optional labels

import type { TerminalRegion } from '../region';
import type { Renderable } from './renderable';
import { color } from '../api/color';
import { drawHorizontalLine } from '../drawing/boxes';

export interface DividerOptions {
  left?: string;
  right?: string;
  fillChar?: string;
  style?: 'single' | 'double' | 'thick' | 'dashed';
  color?: string;
}

/**
 * Create a divider component (horizontal line)
 * Can have left/right labels with a fill line between them
 */
export function createDivider(
  region: TerminalRegion,
  options: DividerOptions = {}
): Renderable {
  const {
    left = '',
    right = '',
    fillChar,
    style = 'single',
    color: dividerColor,
  } = options;

  // Calculate preferred width (left + right + some fill)
  const leftWidth = left.replace(/\x1b\[[0-9;]*m/g, '').length;
  const rightWidth = right.replace(/\x1b\[[0-9;]*m/g, '').length;
  const preferredWidth = leftWidth + rightWidth + 10; // Default fill space

  return {
    flexGrow: 1,
    flexShrink: 1,
    
    getPreferredWidth(): number {
      return preferredWidth;
    },
    
    getMinWidth(): number {
      // Minimum: just left + right labels (no fill)
      return leftWidth + rightWidth;
    },
    
    getMaxWidth(): number {
      return Infinity;
    },
    
    getHeight(): number {
      return 1;
    },
    
    render(x: number, y: number, width: number): void {
      const leftPlain = left.replace(/\x1b\[[0-9;]*m/g, '');
      const rightPlain = right.replace(/\x1b\[[0-9;]*m/g, '');
      const leftWidth = leftPlain.length;
      const rightWidth = rightPlain.length;
      
      // Calculate available space for fill
      const fillWidth = width - leftWidth - rightWidth;
      
      let line = '';
      
      if (fillWidth > 0) {
        // We have space for fill
        const fill = fillChar || drawHorizontalLine(fillWidth, style);
        line = left + fill + right;
      } else {
        // Not enough space - just show left
        line = left;
      }
      
      // Apply color if specified
      if (dividerColor) {
        line = color(dividerColor, line);
      }
      
      // Get existing line and merge
      const existingLine = region.getLine(y) || '';
      const before = existingLine.slice(0, x);
      const after = existingLine.slice(x + width);
      const paddedLine = line.padEnd(width, ' ');
      region.setLine(y, before + paddedLine + after);
    },
  };
}

