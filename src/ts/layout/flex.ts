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
  const gap = options.gap ?? 0;

  // Return a plain object that implements Renderable
  return {
    flexGrow: options.flexGrow ?? 0,
    flexShrink: options.flexShrink ?? 1,
    
    getPreferredWidth(): number {
      const childrenWidth = children.reduce((sum, child) => {
        return sum + child.getPreferredWidth();
      }, 0);
      return childrenWidth + (gap * (children.length - 1));
    },
    
    getMinWidth(): number {
      return options.minWidth ?? 0;
    },
    
    getMaxWidth(): number {
      return options.maxWidth ?? Infinity;
    },
    
    getHeight(): number {
      return Math.max(...children.map(c => c.getHeight()), 0);
    },
    
    render(x: number, y: number, width: number): void {
      renderRow(region, children, x, y, width, gap);
    },
  };
}

// Keep Flex class for backward compatibility (used by resolveFlexTree)
export class Flex {
  private region: TerminalRegion;
  private options: FlexOptions;
  private renderable: Renderable;
  private children: Renderable[] = [];
  private gap: number = 0;
  
  constructor(region: TerminalRegion, options: FlexOptions = {}) {
    this.region = region;
    this.options = options;
    this.gap = options.gap ?? 0;
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

/**
 * Render flex items in a row direction.
 * 
 * Implements row-direction layout from CSS Flexbox spec:
 * https://www.w3.org/TR/css-flexbox-1/#flex-direction-property
 * 
 * @param region - Terminal region to render to
 * @param children - Flex items to render
 * @param x - Starting x position
 * @param y - Starting y position
 * @param width - Available width for the flex container
 * @param gap - Gap between items (row-gap equivalent)
 */
function renderRow(
  region: TerminalRegion,
  children: Renderable[],
  x: number,
  y: number,
  width: number,
  gap: number
): void {
  // Collect flex item properties
  // Spec: https://www.w3.org/TR/css-flexbox-1/#flex-items
  const preferredWidths = children.map(c => c.getPreferredWidth());
  const minWidths = children.map(c => c.getMinWidth());
  const maxWidths = children.map(c => c.getMaxWidth());
  const flexGrows = children.map(c => c.flexGrow);
  const flexShrinks = children.map(c => c.flexShrink);

  // Distribute space using CSS Flexbox algorithm
  // Available width = container width - gaps between items
  // Spec: https://www.w3.org/TR/css-flexbox-1/#gap
  const widths = distributeSpace(
    width - (gap * (children.length - 1)),
    preferredWidths,
    minWidths,
    maxWidths,
    flexGrows,
    flexShrinks
  );

  // Position and render each child
  // All items on a line have the same height, so no vertical alignment needed
  let currentX = x;
  for (let i = 0; i < children.length; i++) {
    const childWidth = widths[i];
    
    // Render child at calculated position and width
    // col.render() handles merging with existing content
    children[i].render(currentX, y, childWidth);
    currentX += childWidth;
    
    // Render gap between items (row-gap equivalent)
    // Spec: https://www.w3.org/TR/css-flexbox-1/#propdef-gap
    // Gap is rendered as spaces between items (not after the last item)
    if (i < children.length - 1 && gap > 0) {
      // Render gap as spaces at the current position
      // We need to write spaces to the region to create visual gaps
      const existingLine = region.getLine(y) || '';
      const existingPlain = existingLine.replace(/\x1b\[[0-9;]*m/g, '');
      const existingVisualWidth = existingPlain.length;
      
      // If we need to pad to create the gap
      if (existingVisualWidth < currentX) {
        const padding = currentX - existingVisualWidth;
        const gapSpaces = ' '.repeat(gap);
        const newLine = existingLine + ' '.repeat(padding) + gapSpaces;
        region.setLine(y, newLine);
      } else {
        // Merge gap spaces into existing line
        // Helper to find character position for visual column
        const findCharPosForVisual = (line: string, targetVisual: number): number => {
          let charPos = 0;
          let visualPos = 0;
          while (charPos < line.length && visualPos < targetVisual) {
            if (line[charPos] === '\x1b') {
              let ansiEnd = charPos + 1;
              while (ansiEnd < line.length) {
                if (line[ansiEnd] === 'm') {
                  ansiEnd++;
                  break;
                }
                if ((line[ansiEnd] >= '0' && line[ansiEnd] <= '9') || 
                    line[ansiEnd] === ';' || 
                    line[ansiEnd] === '[') {
                  ansiEnd++;
                } else {
                  break;
                }
              }
              charPos = ansiEnd;
            } else {
              charPos++;
              visualPos++;
            }
          }
          return charPos;
        };
        
        const beforeEnd = findCharPosForVisual(existingLine, currentX);
        let afterStart: number;
        if (existingVisualWidth <= currentX + gap) {
          afterStart = existingLine.length;
        } else {
          afterStart = findCharPosForVisual(existingLine, currentX + gap);
        }
        
        const before = existingLine.slice(0, beforeEnd);
        const after = existingLine.slice(afterStart);
        const gapSpaces = ' '.repeat(gap);
        const newLine = before + gapSpaces + after;
        
        // Only update if gap section changed
        const existingGap = existingLine.slice(beforeEnd, afterStart);
        if (existingGap !== gapSpaces) {
          region.setLine(y, newLine);
        }
      }
      
      currentX += gap;
    }
  }
}


/**
 * Distribute available space among flex items according to CSS Flexbox algorithm.
 * 
 * Implements the "Resolving Flexible Lengths" algorithm from:
 * https://www.w3.org/TR/css-flexbox-1/#resolve-flexible-lengths
 * 
 * This is based on Section 9.7 of the CSS Flexible Box Layout Module Level 1 spec.
 * 
 * @param availableWidth - Total available width for all items (after accounting for gaps)
 * @param preferredWidths - Base/preferred width of each item (flex base size)
 * @param minWidths - Minimum width constraint for each item (min-width)
 * @param maxWidths - Maximum width constraint for each item (max-width)
 * @param flexGrows - flex-grow factor for each item
 * @param flexShrinks - flex-shrink factor for each item
 * @returns Final width for each item after flex distribution
 */
function distributeSpace(
  availableWidth: number,
  preferredWidths: number[],
  minWidths: number[],
  maxWidths: number[],
  flexGrows: number[],
  flexShrinks: number[]
): number[] {
  // Step 1: Determine the flex base size and hypothetical main size
  // Spec: https://www.w3.org/TR/css-flexbox-1/#flex-base-size
  // Start with preferred widths as the base size
  let widths = [...preferredWidths];
  
  // Step 2: Clamp base sizes by min/max constraints
  // Spec: https://www.w3.org/TR/css-flexbox-1/#min-size-auto
  // Apply min-width and max-width constraints to base sizes
  for (let i = 0; i < widths.length; i++) {
    widths[i] = Math.max(minWidths[i], Math.min(maxWidths[i], widths[i]));
  }

  // Step 3: Calculate free space
  // Spec: https://www.w3.org/TR/css-flexbox-1/#free-space
  // Free space = available space - sum of base sizes
  const totalBase = widths.reduce((sum, w) => sum + w, 0);
  const flexSpace = availableWidth - totalBase;

  if (flexSpace === 0) {
    return widths;
  }

  // Step 4: Distribute free space
  // Spec: https://www.w3.org/TR/css-flexbox-1/#resolve-flexible-lengths
  if (flexSpace > 0) {
    // 4a: Distribute positive free space (flex-grow)
    // Spec: https://www.w3.org/TR/css-flexbox-1/#grow-factor
    // Distribute extra space proportionally based on flex-grow factors
    const totalGrow = flexGrows.reduce((sum, g) => sum + g, 0);
    if (totalGrow > 0) {
      // Calculate flex grow ratio: free space / sum of flex-grow factors
      const flexUnit = flexSpace / totalGrow;
      for (let i = 0; i < widths.length; i++) {
        if (flexGrows[i] > 0) {
          // Add proportional share: base size + (flex-grow * flex unit)
          widths[i] = widths[i] + (flexGrows[i] * flexUnit);
        }
      }
    }
  } else {
    // 4b: Distribute negative free space (flex-shrink)
    // Spec: https://www.w3.org/TR/css-flexbox-1/#shrink-factor
    // Shrink items proportionally based on flex-shrink factors, but respect min-width
    // Calculate shrinkable space (only count space above min-width)
    const totalShrink = flexShrinks.reduce((sum, s, i) => {
      // Only count items that can shrink (have flex-shrink > 0 and are above min-width)
      return sum + (s > 0 && widths[i] > minWidths[i] ? widths[i] - minWidths[i] : 0);
    }, 0);
    
    if (totalShrink > 0) {
      // Calculate shrink ratio: negative free space / total shrinkable space
      const shrinkUnit = Math.abs(flexSpace) / totalShrink;
      for (let i = 0; i < widths.length; i++) {
        if (flexShrinks[i] > 0 && widths[i] > minWidths[i]) {
          // Shrink proportionally, but don't go below min-width
          const shrinkable = widths[i] - minWidths[i];
          const shrinkAmount = Math.min(shrinkable, shrinkable * shrinkUnit);
          widths[i] = widths[i] - shrinkAmount;
        }
      }
    }
  }

  // Step 5: Fix min/max violations
  // Spec: https://www.w3.org/TR/css-flexbox-1/#min-max-violations
  // After flex distribution, clamp again to ensure min/max constraints are respected
  // This may cause total width to exceed available space, which we handle in Step 6
  for (let i = 0; i < widths.length; i++) {
    widths[i] = Math.max(minWidths[i], Math.min(maxWidths[i], Math.round(widths[i])));
  }
  
  // Step 6: Handle overflow due to min-width constraints
  // Spec: https://www.w3.org/TR/css-flexbox-1/#min-size-auto
  // If min-width constraints cause total width to exceed available space,
  // we must shrink items that can shrink (those above their min-width)
  const totalWidth = widths.reduce((sum, w) => sum + w, 0);
  if (totalWidth > availableWidth) {
    const excess = totalWidth - availableWidth;
    // Prioritize shrinking items with lower min-width (they can shrink more)
    // This is a simplified approach - the full spec has more complex rules
    const shrinkable = widths.map((w, i) => ({
      index: i,
      width: w,
      min: minWidths[i],
      canShrink: w > minWidths[i],
      shrinkable: w - minWidths[i]
    })).filter(item => item.canShrink).sort((a, b) => {
      // Sort by min-width (lower min = can shrink more = lower priority to preserve)
      if (a.min !== b.min) return a.min - b.min;
      return a.shrinkable - b.shrinkable;
    });
    
    // Shrink items in priority order until excess is eliminated
    let remainingExcess = excess;
    for (const item of shrinkable) {
      if (remainingExcess <= 0) break;
      const shrinkAmount = Math.min(remainingExcess, item.shrinkable);
      widths[item.index] -= shrinkAmount;
      remainingExcess -= shrinkAmount;
    }
  }

  return widths;
}

export interface FlexOptions {
  gap?: number;
  minWidth?: number;
  maxWidth?: number;
  flexGrow?: number;
  flexShrink?: number;
  width?: number;
}

