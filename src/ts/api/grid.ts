// Grid API - public functions for creating grid components

import type { TerminalRegion } from '../region';
import { createGrid, type GridComponent, type Component, type GridOptions } from '../layout/grid';
import { style, type StyleOptions } from '../components/style';

/**
 * Create a grid descriptor (for use with region.set())
 */
export function grid(
  options: GridOptions,
  ...children: (Component | string)[]
): GridDescriptor {
  // Convert strings to style components
  const convertedChildren: Component[] = children.map(child => {
    if (typeof child === 'string') {
      return style({}, child);
    }
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
  children: Component[];
}

/**
 * Resolve a grid descriptor into a GridComponent
 */
export function resolveGrid(
  region: TerminalRegion,
  descriptor: GridDescriptor
): GridComponent {
  return createGrid(region, descriptor.options, ...descriptor.children);
}

/**
 * Export style function for convenience
 */
export { style, type StyleOptions };

