// Divider API - function-based descriptor

import type { TerminalRegion } from '../region';
import type { Renderable } from '../components/renderable';
import { createDivider } from '../components/divider';
import type { DividerOptions } from '../components/divider';

/**
 * Descriptor for a divider (resolved later with region)
 */
export interface DividerDescriptor {
  type: 'divider';
  options: DividerOptions;
}

/**
 * Create a divider descriptor
 */
export function divider(options: DividerOptions = {}): DividerDescriptor {
  return {
    type: 'divider',
    options,
  };
}

/**
 * Resolve a divider descriptor into a Renderable
 */
export function resolveDivider(
  region: TerminalRegion,
  descriptor: DividerDescriptor
): Renderable {
  return createDivider(region, descriptor.options);
}

