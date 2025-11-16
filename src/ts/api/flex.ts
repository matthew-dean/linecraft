// Function-based API for flex layouts

import { Flex } from '../layout/flex';
import { Col } from '../components/col';
import type { TerminalRegion } from '../region';
import type { FlexOptions } from '../layout/flex';
import type { ColOptions } from '../components/col';
import type { FlexChild } from '../components/renderable';
import { resolveDivider } from './divider';
import type { DividerDescriptor } from './divider';

// Re-export FlexChild for convenience
export type { FlexChild };

// Extended type that includes descriptors
export type FlexChildWithDescriptors = FlexChild | ColDescriptor | FlexDescriptor | DividerDescriptor;

/**
 * Descriptor for a flex container (resolved later with region)
 */
export interface FlexDescriptor {
  type: 'flex';
  options: FlexOptions;
  children: FlexChild[];
}

/**
 * Descriptor for a column (resolved later with region)
 */
export interface ColDescriptor {
  type: 'col';
  options: ColOptions;
  content: string;
}

/**
 * Create a flex container with children
 * Accepts strings, Renderables, arrays (for functional components), or descriptors
 */
export function flex(
  options: FlexOptions,
  ...children: FlexChildWithDescriptors[]
): FlexDescriptor {
  return {
    type: 'flex',
    options,
    children: children as FlexChild[],
  };
}

/**
 * Create a column (flex item) with options and content
 */
export function col(
  options: ColOptions,
  content: string
): ColDescriptor {
  return {
    type: 'col',
    options,
    content,
  };
}

/**
 * Resolve a flex descriptor tree into actual components
 * Handles strings, arrays (for functional components), and descriptors
 */
export function resolveFlexTree(
  region: TerminalRegion,
  descriptor: FlexDescriptor | ColDescriptor | FlexChild
): Flex | Col {
  if (typeof descriptor === 'string') {
    // Plain string - wrap in col
    return new Col(region, descriptor, {});
  }

  // Check if it's a descriptor object
  if (typeof descriptor === 'object' && descriptor !== null && 'type' in descriptor) {
    if (descriptor.type === 'col') {
      return new Col(region, descriptor.content, descriptor.options);
    }

    if (descriptor.type === 'flex') {
      const flexComponent = new Flex(region, descriptor.options);
      
      // Resolve children - Flex.addChild now handles strings, arrays, and Renderables
      for (const child of descriptor.children) {
        if (typeof child === 'string') {
          // Plain string - Flex.addChild will handle it
          flexComponent.addChild(child);
        } else if (typeof child === 'object' && child !== null && 'type' in child) {
          // Check if it's a descriptor
          if (child.type === 'col' || child.type === 'flex') {
            const resolved = resolveFlexTree(region, child as unknown as FlexDescriptor | ColDescriptor);
            flexComponent.addChild(resolved);
          } else if (child.type === 'divider') {
            const resolved = resolveDivider(region, child as DividerDescriptor);
            flexComponent.addChild(resolved);
          } else {
            // Not a descriptor, pass through as-is
            flexComponent.addChild(child as any);
          }
        } else {
          // Already a Renderable or array - pass through
          flexComponent.addChild(child);
        }
      }
      
      return flexComponent;
    }
  }

  throw new Error(`Unknown descriptor type: ${(descriptor as any).type || typeof descriptor}`);
}

/**
 * Helper for functional components that return arrays
 * Example:
 * ```ts
 * function myComponent(options, ...children) {
 *   return component([
 *     'Label:',
 *     ...children
 *   ]);
 * }
 * ```
 * 
 * Actually, you don't need this helper - just return the array directly!
 * Flex will automatically flatten arrays.
 */
export function component(children: FlexChild[]): FlexChild[] {
  return children;
}
