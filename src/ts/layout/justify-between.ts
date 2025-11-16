// Justify-between layout - left element, fill line, right element
// Responsive: hides right element and fill when width is too small

import type { TerminalRegion } from '../region';
import type { Renderable, FlexChild } from '../components/renderable';
import { Flex } from './flex';
import { Col } from '../components/col';
import { divider, resolveDivider } from '../api/divider';
import { toRenderable } from '../components/renderable';

export interface JustifyBetweenOptions {
  left: FlexChild;
  right: FlexChild;
  fillChar?: string;
  fillStyle?: 'single' | 'double' | 'thick' | 'dashed';
  minWidthForRight?: number; // Hide right element if width < this
  gap?: number;
}

/**
 * Create a justify-between layout (left, fill line, right)
 * Responsive: hides right element when terminal is too narrow
 */
export function createJustifyBetween(
  region: TerminalRegion,
  options: JustifyBetweenOptions
): Renderable {
  const {
    left,
    right,
    fillChar = '─',
    fillStyle = 'single',
    minWidthForRight = 40,
    gap = 0,
  } = options;

  const leftRenderable = toRenderable(region, left);
  const rightRenderable = toRenderable(region, right);

  return {
    flexGrow: 1,
    flexShrink: 1,
    
    getPreferredWidth(): number {
      return leftRenderable.getPreferredWidth() + rightRenderable.getPreferredWidth() + 20;
    },
    
    getMinWidth(): number {
      // Minimum is just the left element
      return leftRenderable.getMinWidth();
    },
    
    getMaxWidth(): number {
      return Infinity;
    },
    
    getHeight(): number {
      return Math.max(leftRenderable.getHeight(), rightRenderable.getHeight());
    },
    
    render(x: number, y: number, width: number): void {
      const leftWidth = leftRenderable.getPreferredWidth();
      const rightWidth = rightRenderable.getPreferredWidth();
      
      // Check if we should show right element
      const showRight = width >= minWidthForRight;
      
      if (showRight) {
        // Full layout: left, fill, right
        const availableForFill = width - leftWidth - rightWidth - gap * 2;
        
        if (availableForFill > 0) {
          // Render left
          leftRenderable.render(x, y, leftWidth);
          
          // Render fill divider
          const dividerComponent = resolveDivider(region, divider({
            fillChar,
            style: fillStyle,
          }));
          dividerComponent.render(x + leftWidth + gap, y, availableForFill);
          
          // Render right
          rightRenderable.render(x + leftWidth + gap + availableForFill + gap, y, rightWidth);
        } else {
          // Not enough space, just render left
          leftRenderable.render(x, y, Math.min(leftWidth, width));
        }
      } else {
        // Too narrow - just render left
        leftRenderable.render(x, y, Math.min(leftWidth, width));
      }
    },
  };
}

