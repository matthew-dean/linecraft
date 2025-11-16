// Responsive layout utilities - hide/show elements based on width

import type { TerminalRegion } from '../region';
import type { Renderable, FlexChild } from '../components/renderable';
import { toRenderable } from '../components/renderable';

export interface ResponsiveOptions {
  minWidth?: number; // Hide if width < minWidth
  maxWidth?: number; // Hide if width > maxWidth
  fallback?: FlexChild; // Show this instead when hidden
}

/**
 * Create a responsive wrapper that hides/shows content based on width
 */
export function createResponsive(
  region: TerminalRegion,
  content: FlexChild,
  options: ResponsiveOptions = {}
): Renderable {
  const {
    minWidth = 0,
    maxWidth = Infinity,
    fallback,
  } = options;

  const contentRenderable = toRenderable(region, content);
  const fallbackRenderable = fallback ? toRenderable(region, fallback) : null;

  return {
    flexGrow: contentRenderable.flexGrow,
    flexShrink: contentRenderable.flexShrink,
    
    getPreferredWidth(): number {
      return contentRenderable.getPreferredWidth();
    },
    
    getMinWidth(): number {
      return fallbackRenderable ? fallbackRenderable.getMinWidth() : contentRenderable.getMinWidth();
    },
    
    getMaxWidth(): number {
      return contentRenderable.getMaxWidth();
    },
    
    getHeight(): number {
      return contentRenderable.getHeight();
    },
    
    render(x: number, y: number, width: number): void {
      // Check if we should show content or fallback
      const showContent = width >= minWidth && width <= maxWidth;
      
      if (showContent) {
        contentRenderable.render(x, y, width);
      } else if (fallbackRenderable) {
        fallbackRenderable.render(x, y, width);
      }
      // Otherwise, render nothing (hidden)
    },
  };
}

