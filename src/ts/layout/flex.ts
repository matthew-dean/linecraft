// Flexbox-like layout system for terminal components
// Just functions that return Renderable objects - no classes needed!

import type { TerminalRegion } from '../region.js';
import type { Renderable, FlexChild } from '../components/renderable.js';
import { flattenChildren, toRenderable } from '../components/renderable.js';

/**
 * Create a flex container - just a function that returns a Renderable!
 */
export function createFlex(
  region: TerminalRegion,
  options: FlexOptions = {},
  children: Renderable[] = []
): Renderable {
  const direction = options.direction ?? 'row';
  const gap = options.gap ?? 0;
  const justifyContent = options.justifyContent ?? 'start';
  const alignItems = options.alignItems ?? 'stretch';

  // Return a plain object that implements Renderable
  return {
    flexGrow: options.flexGrow ?? 0,
    flexShrink: options.flexShrink ?? 1,
    
    getPreferredWidth(): number {
      if (direction === 'row') {
        const childrenWidth = children.reduce((sum, child) => {
          return sum + child.getPreferredWidth();
        }, 0);
        return childrenWidth + (gap * (children.length - 1));
      } else {
        return Math.max(...children.map(c => c.getPreferredWidth()), 0);
      }
    },
    
    getMinWidth(): number {
      return options.minWidth ?? 0;
    },
    
    getMaxWidth(): number {
      return options.maxWidth ?? Infinity;
    },
    
    getHeight(): number {
      if (direction === 'column') {
        const childrenHeight = children.reduce((sum, child) => {
          return sum + child.getHeight();
        }, 0);
        return childrenHeight + (gap * (children.length - 1));
      } else {
        return Math.max(...children.map(c => c.getHeight()), 0);
      }
    },
    
    render(x: number, y: number, width: number): void {
      if (direction === 'row') {
        renderRow(region, children, x, y, width, gap, alignItems);
      } else {
        renderColumn(region, children, x, y, width, gap, alignItems);
      }
    },
  };
}

// Keep Flex class for backward compatibility (used by resolveFlexTree)
export class Flex {
  private region: TerminalRegion;
  private options: FlexOptions;
  private renderable: Renderable;
  private children: Renderable[] = [];
  private direction: 'row' | 'column' = 'row';
  private gap: number = 0;
  private alignItems: 'start' | 'end' | 'center' | 'stretch' = 'stretch';
  
  constructor(region: TerminalRegion, options: FlexOptions = {}) {
    this.region = region;
    this.options = options;
    this.direction = options.direction ?? 'row';
    this.gap = options.gap ?? 0;
    this.alignItems = options.alignItems ?? 'stretch';
    this.renderable = createFlex(region, options, this.children);
  }
  
  /**
   * Add a child - accepts string, Renderable, or array (for functional components)
   */
  addChild(child: FlexChild): void {
    // Flatten arrays
    const flat = Array.isArray(child) ? flattenChildren(child) : [child];
    
    // Convert to Renderables
    for (const item of flat) {
      const renderable = toRenderable(this.region, item);
      this.children.push(renderable);
    }
    
    // Recreate renderable with updated children
    this.renderable = createFlex(this.region, this.options, this.children);
  }
  
  getPreferredWidth(): number { return this.renderable.getPreferredWidth(); }
  getMinWidth(): number { return this.renderable.getMinWidth(); }
  getMaxWidth(): number { return this.renderable.getMaxWidth(); }
  getHeight(): number { return this.renderable.getHeight(); }
  render(x: number, y: number, width: number): void { this.renderable.render(x, y, width); }
  get flexGrow(): number { return this.renderable.flexGrow; }
  get flexShrink(): number { return this.renderable.flexShrink; }
}

// Helper functions for rendering (used by createFlex)
function renderRow(
  region: TerminalRegion,
  children: Renderable[],
  x: number,
  y: number,
  width: number,
  gap: number,
  alignItems: 'start' | 'end' | 'center' | 'stretch'
): void {
  // Calculate available space and flex distribution
  const preferredWidths = children.map(c => c.getPreferredWidth());
  const minWidths = children.map(c => c.getMinWidth());
  const maxWidths = children.map(c => c.getMaxWidth());
  const flexGrows = children.map(c => c.flexGrow);
  const flexShrinks = children.map(c => c.flexShrink);

  // Distribute space
  const widths = distributeSpace(
    width - (gap * (children.length - 1)),
    preferredWidths,
    minWidths,
    maxWidths,
    flexGrows,
    flexShrinks
  );

  // Calculate container height for alignment
  const containerHeight = Math.max(...children.map(c => c.getHeight()), 0);

  // Position children (col.render() handles merging with existing content)
  let currentX = x;
  for (let i = 0; i < children.length; i++) {
    const childWidth = widths[i];
    const childHeight = children[i].getHeight();
    const childY = alignChildY(y, childHeight, containerHeight, alignItems);
    
    children[i].render(currentX, childY, childWidth);
    currentX += childWidth + gap;
  }
}

function renderColumn(
  region: TerminalRegion,
  children: Renderable[],
  x: number,
  y: number,
  width: number,
  gap: number,
  alignItems: 'start' | 'end' | 'center' | 'stretch'
): void {
  let currentY = y;
  const childWidth = Math.min(width, Math.max(...children.map(c => c.getPreferredWidth()), 0));
  
  for (const child of children) {
    const childHeight = child.getHeight();
    const childPreferredWidth = child.getPreferredWidth();
    const childX = alignChildX(x, childWidth, childPreferredWidth, alignItems);
    
    child.render(childX, currentY, childWidth);
    currentY += childHeight + gap;
  }
}

function alignChildY(
  y: number,
  childHeight: number,
  containerHeight: number,
  alignItems: 'start' | 'end' | 'center' | 'stretch'
): number {
  switch (alignItems) {
    case 'start':
      return y;
    case 'end':
      return y + containerHeight - childHeight;
    case 'center':
      return y + Math.floor((containerHeight - childHeight) / 2);
    case 'stretch':
      return y;
    default:
      return y;
  }
}

function alignChildX(
  x: number,
  containerWidth: number,
  childWidth: number,
  alignItems: 'start' | 'end' | 'center' | 'stretch'
): number {
  switch (alignItems) {
    case 'start':
      return x;
    case 'end':
      return x + containerWidth - childWidth;
    case 'center':
      return x + Math.floor((containerWidth - childWidth) / 2);
    case 'stretch':
      return x;
    default:
      return x;
  }
}

function distributeSpace(
  availableWidth: number,
  preferredWidths: number[],
  minWidths: number[],
  maxWidths: number[],
  flexGrows: number[],
  flexShrinks: number[]
): number[] {
  // Step 1: Start with base sizes (preferred widths)
  let widths = [...preferredWidths];
  
  // Step 2: Apply min/max constraints to base sizes
  for (let i = 0; i < widths.length; i++) {
    widths[i] = Math.max(minWidths[i], Math.min(maxWidths[i], widths[i]));
  }

  // Step 3: Calculate available space for flex distribution
  const totalBase = widths.reduce((sum, w) => sum + w, 0);
  const flexSpace = availableWidth - totalBase;

  if (flexSpace === 0) {
    return widths;
  }

  // Step 4: Distribute flex space
  if (flexSpace > 0) {
    // Extra space - distribute based on flexGrow
    const totalGrow = flexGrows.reduce((sum, g) => sum + g, 0);
    if (totalGrow > 0) {
      const flexUnit = flexSpace / totalGrow;
      for (let i = 0; i < widths.length; i++) {
        if (flexGrows[i] > 0) {
          widths[i] = widths[i] + (flexGrows[i] * flexUnit);
        }
      }
    }
  } else {
    // Not enough space - shrink based on flexShrink
    const totalShrink = flexShrinks.reduce((sum, s, i) => {
      return sum + (s > 0 ? widths[i] : 0);
    }, 0);
    
    if (totalShrink > 0) {
      const shrinkUnit = Math.abs(flexSpace) / totalShrink;
      for (let i = 0; i < widths.length; i++) {
        if (flexShrinks[i] > 0) {
          widths[i] = widths[i] - (widths[i] * shrinkUnit);
        }
      }
    }
  }

  // Step 5: Apply constraints again after flex distribution
  for (let i = 0; i < widths.length; i++) {
    widths[i] = Math.max(minWidths[i], Math.min(maxWidths[i], Math.round(widths[i])));
  }

  return widths;
}

export interface FlexOptions {
  direction?: 'row' | 'column';
  gap?: number;
  justifyContent?: 'start' | 'end' | 'center' | 'space-between' | 'space-around';
  alignItems?: 'start' | 'end' | 'center' | 'stretch';
  minWidth?: number;
  maxWidth?: number;
  flexGrow?: number;
  flexShrink?: number;
  width?: number;
}

