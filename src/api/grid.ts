// Grid API - public functions for creating grid components

import type { TerminalRegion } from '../region';
import { createGrid, type GridComponent, type Component, type GridOptions, grid as gridComponent } from '../layout/grid';
import { style, type StyleOptions } from '../components/style';

/**
 * Create a grid descriptor (for use with region.set())
 * This is the main API - returns a descriptor that region.set() can handle
 */
export function grid(
  options: GridOptions,
  ...children: (Component | string | GridDescriptor)[]
): GridDescriptor {
  // Convert strings to style components
  // Convert nested GridDescriptors to Components
  const convertedChildren: (Component | GridDescriptor)[] = children.map(child => {
    if (typeof child === 'string') {
      return style({}, child);
    }
    // Keep GridDescriptors as-is - they'll be resolved later in resolveGrid
    return child;
  });
  
  return {
    type: 'grid',
    options,
    children: convertedChildren,
  };
}

export interface GridDescriptor {
  type: 'grid';
  options: GridOptions;
  children: (Component | GridDescriptor)[];
}

/**
 * Resolve a grid descriptor into a GridComponent
 */
export function resolveGrid(
  region: TerminalRegion,
  descriptor: GridDescriptor
): GridComponent {
  // Convert children - GridDescriptors become Components, Components stay as-is
  const convertedChildren: Component[] = descriptor.children.map((child): Component => {
    if (typeof child === 'object' && child !== null && 'type' in child && child.type === 'grid') {
      // It's a nested GridDescriptor - recursively resolve it, then convert to Component
      const nestedGridComponent = resolveGrid(region, child);
      // Convert GridComponent to Component by wrapping it
      return (ctx) => {
        // Save current line content
        const savedLines: string[] = [];
        const startLine = ctx.rowIndex + 1;
        const maxLines = nestedGridComponent.getHeight();
        for (let i = 0; i < maxLines; i++) {
          savedLines.push(region.getLine(startLine + i) || '');
        }
        
        // Render the nested grid
        nestedGridComponent.render(ctx.columnIndex, startLine, ctx.availableWidth);
        
        // Read back the rendered content
        if (maxLines === 1) {
          return region.getLine(startLine) || '';
        } else {
          const lines: string[] = [];
          for (let i = 0; i < maxLines; i++) {
            lines.push(region.getLine(startLine + i) || '');
          }
          return lines;
        }
      };
    }
    return child as Component;
  });
  
  return createGrid(region, descriptor.options, ...convertedChildren);
}

/**
 * Export style function for convenience
 */
export { style, type StyleOptions };

