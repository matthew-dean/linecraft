// Rounded box component for terminal UI

import type { TerminalRegion } from '../region';
import type { Renderable } from './renderable';
import { drawRoundedBox, type BoxOptions } from '../drawing/boxes';
import { color } from '../api/color';
import { Col } from './col';

export interface RoundedBoxOptions {
  width: number;
  height: number;
  title?: string;
  titleColor?: string;
  borderColor?: string;
  style?: 'rounded' | 'double' | 'single';
}

/**
 * Create a rounded box component
 * Returns a Renderable that can be used in flex layouts
 */
export function roundedBox(options: RoundedBoxOptions): Renderable {
  const {
    width,
    height,
    title,
    titleColor = 'brightWhite',
    borderColor,
    style = 'rounded',
  } = options;

  // Choose box style
  let boxOptions: BoxOptions = {};
  if (style === 'double') {
    boxOptions = {
      topLeft: '╔',
      topRight: '╗',
      bottomLeft: '╚',
      bottomRight: '╝',
      horizontal: '═',
      vertical: '║',
    };
  } else if (style === 'single') {
    boxOptions = {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
    };
  } else {
    // rounded (default)
    boxOptions = {
      topLeft: '╭',
      topRight: '╮',
      bottomLeft: '╰',
      bottomRight: '╯',
      horizontal: '─',
      vertical: '│',
    };
  }

  // Generate box lines
  const boxLines = drawRoundedBox(width, height, boxOptions);

  // Add title to top line if provided
  if (title) {
    const titleText = title.length > width - 4 ? title.substring(0, width - 4) : title;
    const titleLine = boxOptions.vertical + ' ' + titleText + ' ' + boxOptions.vertical;
    // Replace the top border with title line
    boxLines[0] = titleLine;
    // Apply colors
    if (titleColor) {
      boxLines[0] = color(titleColor, boxLines[0]);
    }
  }

  // Apply border color if specified
  if (borderColor) {
    for (let i = 0; i < boxLines.length; i++) {
      boxLines[i] = color(borderColor, boxLines[i]);
    }
  }

  // Return a Renderable that renders the box as a multi-line column
  return {
    flexGrow: 0,
    flexShrink: 1,
    
    getPreferredWidth(): number {
      return width;
    },
    
    getMinWidth(): number {
      return width;
    },
    
    getMaxWidth(): number {
      return width;
    },
    
    getHeight(): number {
      return height;
    },
    
    render(x: number, y: number, availableWidth: number): void {
      // This will be called by flex, but we need a region to render
      // We'll need to pass region through or use a different approach
      // For now, return a Renderable that can be used with Col
      throw new Error('roundedBox must be used with a region context');
    },
  };
}

/**
 * Create a rounded box component that works with TerminalRegion
 * This version accepts a region and returns a Col that can be used in flex
 */
export function createRoundedBox(
  region: TerminalRegion,
  options: RoundedBoxOptions
): Renderable {
  const {
    width,
    height,
    title,
    titleColor = 'brightWhite',
    borderColor,
    style = 'rounded',
  } = options;

  // Choose box style
  let boxOptions: BoxOptions = {};
  if (style === 'double') {
    boxOptions = {
      topLeft: '╔',
      topRight: '╗',
      bottomLeft: '╚',
      bottomRight: '╝',
      horizontal: '═',
      vertical: '║',
    };
  } else if (style === 'single') {
    boxOptions = {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
    };
  } else {
    // rounded (default)
    boxOptions = {
      topLeft: '╭',
      topRight: '╮',
      bottomLeft: '╰',
      bottomRight: '╯',
      horizontal: '─',
      vertical: '│',
    };
  }

  // Generate box lines
  const boxLines = drawRoundedBox(width, height, boxOptions);

  // Add title to top line if provided
  if (title) {
    const titleText = title.length > width - 4 ? title.substring(0, width - 4) : title;
    const titleLine = boxOptions.vertical + ' ' + titleText + ' ' + boxOptions.vertical;
    // Replace the top border with title line
    boxLines[0] = titleLine;
    // Apply colors
    if (titleColor) {
      boxLines[0] = color(titleColor, boxLines[0]);
    }
  }

  // Apply border color if specified
  if (borderColor) {
    for (let i = 0; i < boxLines.length; i++) {
      boxLines[i] = color(borderColor, boxLines[i]);
    }
  }

  // Create a multi-line Col that renders each box line
  // We'll need to create a custom Renderable that handles multi-line rendering
  return {
    flexGrow: 0,
    flexShrink: 1,
    
    getPreferredWidth(): number {
      return width;
    },
    
    getMinWidth(): number {
      return width;
    },
    
    getMaxWidth(): number {
      return width;
    },
    
    getHeight(): number {
      return height;
    },
    
    render(x: number, y: number, availableWidth: number): void {
      // Render each line of the box
      for (let i = 0; i < boxLines.length; i++) {
        region.setLine(y + i, boxLines[i]);
      }
    },
  };
}

