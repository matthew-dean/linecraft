// Base component system for terminal UI
// Simplified - no parent/child wiring needed

import { TerminalRegion } from '../region';
import type { Renderable } from './renderable';

/**
 * Base class for terminal UI components
 * Provides layout properties and rendering interface
 * 
 * Note: We don't need parent/child relationships. Flex just needs:
 * - An array of renderables to measure and render
 * - No need for components to know their parent
 */
export abstract class Component implements Renderable {
  protected region: TerminalRegion;
  protected children: Component[] = [];
  protected minWidth: number = 0;
  protected maxWidth: number = Infinity;
  public readonly flexGrow: number = 0;
  public readonly flexShrink: number = 1;
  protected width?: number; // Explicit width override

  constructor(region: TerminalRegion, options: ComponentOptions = {}) {
    this.region = region;
    this.minWidth = options.minWidth ?? 0;
    this.maxWidth = options.maxWidth ?? Infinity;
    this.flexGrow = options.flexGrow ?? 0;
    this.flexShrink = options.flexShrink ?? 1;
    this.width = options.width;
  }

  /**
   * Add a child component (for Flex to build its children array)
   * No parent wiring needed - Flex just iterates over children
   */
  addChild(child: Component): void {
    this.children.push(child);
  }

  /**
   * Get the preferred width of this component
   */
  abstract getPreferredWidth(): number;

  /**
   * Get the minimum width this component needs
   */
  getMinWidth(): number {
    return this.minWidth;
  }

  /**
   * Get the maximum width this component can use
   */
  getMaxWidth(): number {
    return this.maxWidth;
  }

  /**
   * Render the component at the given position and width
   */
  abstract render(x: number, y: number, width: number): void;

  /**
   * Get the height this component will take
   */
  abstract getHeight(): number;
}

export interface ComponentOptions {
  minWidth?: number;
  maxWidth?: number;
  flexGrow?: number; // How much this component should grow (0 = don't grow)
  flexShrink?: number; // How much this component should shrink (0 = don't shrink)
  width?: number; // Explicit width override
}

