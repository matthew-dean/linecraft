import type { TerminalRegion } from './region';

/**
 * RenderContext provides information needed for rendering
 */
export interface RenderContext {
  availableWidth: number;  // Width allocated to this component
  region: TerminalRegion;  // For setLine access (needed for multi-line)
  columnIndex: number;     // Which grid column (0-based)
  rowIndex: number;         // Which grid row (0-based, for multi-line)
  onUpdate?: () => void;   // Optional callback for components to trigger re-renders when their state changes
  onCleanup?: (callback: () => void) => void;  // Optional callback for components to register cleanup (called when component is removed/replaced)
}

/**
 * Component type: can be a function or an object with a render method
 */
export type Component = 
  | ((ctx: RenderContext) => string | string[] | null)
  | { render: (ctx: RenderContext) => string | string[] | null };

/**
 * Helper to call a component (handles both function and object forms)
 */
export function callComponent(component: Component, ctx: RenderContext): string | string[] | null {
  if (typeof component === 'function') {
    return component(ctx);
  }
  return component.render(ctx);
}

/**
 * Create a child RenderContext from a parent, with optional overrides
 * This ensures all properties from the parent are passed through, including onUpdate
 */
export function createChildContext(
  parent: RenderContext,
  overrides: Partial<RenderContext>
): RenderContext {
  return {
    ...parent,
    ...overrides,
  };
}

/**
 * Render children components and return flattened lines
 * Handles null returns, array flattening, and rowIndex tracking automatically
 * Inspired by React's children rendering pattern
 */
export function renderChildren(
  children: Component[],
  ctx: RenderContext
): string[] {
  const lines: string[] = [];
  for (const child of children) {
    const result = callComponent(child, createChildContext(ctx, {
      rowIndex: lines.length,
    }));
    
    if (result === null) continue;
    
    if (Array.isArray(result)) {
      lines.push(...result);
    } else {
      lines.push(result);
    }
  }
  return lines;
}

