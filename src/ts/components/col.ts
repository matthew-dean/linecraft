// Column component - flex item wrapper for terminal UI
// Handles text content with overflow and flex properties
// Just a function that returns a Renderable object - no class needed!

import type { TerminalRegion } from '../region';
import type { Renderable } from './renderable';
import type { BaseComponentOptions } from '../types';
import { truncateEnd, truncateStart, truncateMiddle, wrapText } from '../utils/text';
import { applyStyle } from '../utils/colors';

export type TextOverflow = 'none' | 'ellipsis-end' | 'ellipsis-start' | 'ellipsis-middle' | 'wrap';

/**
 * Create a column renderable - just a function, no class!
 */
export function createCol(
  region: TerminalRegion,
  content: string,
  options: ColOptions = {}
): Renderable {
  // Calculate content width for default min (strip ANSI codes)
  const contentWidth = content.replace(/\x1b\[[0-9;]*m/g, '').length;
  
  // If width is specified, set both min and max to that value (fixed width)
  const fixedWidth = options.width;
  const minWidth = fixedWidth ?? options.min ?? contentWidth;
  const maxWidth = fixedWidth ?? options.max ?? Infinity;
  const flexGrow = options.flex ?? 0;
  const overflow = options.overflow ?? 'ellipsis-end';
  const bg = options.bg ?? options.fill; // Support both 'bg' and 'fill' for backward compatibility
  
  // Apply color to content if specified (from BaseComponentOptions)
  const finalContent = options.color ? applyStyle(content, { color: options.color }) : content;

  // Return a plain object that implements Renderable
  return {
    flexGrow,
    flexShrink: 1,
    
    getPreferredWidth(): number {
      return contentWidth;
    },
    
    getMinWidth(): number {
      return minWidth;
    },
    
    getMaxWidth(): number {
      return maxWidth;
    },
    
    getHeight(): number {
      if (overflow === 'wrap') {
        const width = undefined; // Will be set during render
        return wrapText(finalContent.replace(/\x1b\[[0-9;]*m/g, ''), width ?? contentWidth).length;
      }
      return 1;
    },
    
    render(x: number, y: number, width: number): void {
      let text = finalContent;
      const textWidth = finalContent.replace(/\x1b\[[0-9;]*m/g, '').length;
      
      // Handle overflow
      if (overflow === 'ellipsis-end' && textWidth > width) {
        text = truncateEnd(finalContent.replace(/\x1b\[[0-9;]*m/g, ''), width);
      } else if (overflow === 'ellipsis-start' && textWidth > width) {
        text = truncateStart(finalContent.replace(/\x1b\[[0-9;]*m/g, ''), width);
      } else if (overflow === 'ellipsis-middle' && textWidth > width) {
        text = truncateMiddle(finalContent.replace(/\x1b\[[0-9;]*m/g, ''), width);
      } else if (overflow === 'wrap') {
        const lines = wrapText(finalContent.replace(/\x1b\[[0-9;]*m/g, ''), width);
        for (let i = 0; i < lines.length; i++) {
          // For wrap, we need to handle x position too
          const existingLine = region.getLine(y + i) || '';
          const before = existingLine.slice(0, x);
          const after = existingLine.slice(x + width);
          const wrappedText = lines[i].padEnd(width, ' ');
          region.setLine(y + i, before + wrappedText + after);
        }
        return;
      }

      // If bg is specified, fill the column width with the background character, then append content
      if (bg) {
        const plainText = text.replace(/\x1b\[[0-9;]*m/g, '');
        const bgWidth = Math.max(0, width - plainText.length);
        const bgStr = bg.repeat(bgWidth);
        text = bgStr + text;
      } else {
        // Pad to width with spaces
        const plainText = text.replace(/\x1b\[[0-9;]*m/g, '');
        const padding = width - plainText.length;
        if (padding > 0) {
          text = text + ' '.repeat(padding);
        }
      }
      
      // Get existing line and merge at x position
      const existingLine = region.getLine(y) || '';
      
      // Helper to find character position for a visual column (accounting for ANSI codes)
      const findCharPosForVisual = (line: string, targetVisual: number): number => {
        let charPos = 0;
        let visualPos = 0;
        
        while (charPos < line.length && visualPos < targetVisual) {
          if (line[charPos] === '\x1b') {
            // Found start of ANSI code, skip to end
            let ansiEnd = charPos + 1;
            while (ansiEnd < line.length) {
              if (line[ansiEnd] === 'm') {
                ansiEnd++;
                break;
              }
              // Valid ANSI code characters
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
      
      // Calculate visual width of existing line
      const existingPlain = existingLine.replace(/\x1b\[[0-9;]*m/g, '');
      const existingVisualWidth = existingPlain.length;
      
      if (x === 0 && existingVisualWidth === 0) {
        // Starting at beginning with empty line - just set it
        region.setLine(y, text);
      } else {
        // Need to merge: before + text + after
        const beforeEnd = findCharPosForVisual(existingLine, x);
        
        // If existing line is shorter than x, we need to pad it first
        if (existingVisualWidth < x) {
          // Pad existing line to x position, then append our text
          const padding = x - existingVisualWidth;
          const newLine = existingLine + ' '.repeat(padding) + text;
          region.setLine(y, newLine);
          return;
        }
        
        // Find where x + width starts in the existing line
        let afterStart: number;
        if (existingVisualWidth <= x + width) {
          // Existing line ends before or at our end position - no "after" content
          afterStart = existingLine.length;
        } else {
          // Find where x + width starts in the existing line
          afterStart = findCharPosForVisual(existingLine, x + width);
        }
        
        const before = existingLine.slice(0, beforeEnd);
        const after = existingLine.slice(afterStart);
        
        // Build new line
        const newLine = before + text + after;
        
        // Only update if the section we're replacing actually changed
        // Extract the section we're replacing from existing line
        const existingSection = existingLine.slice(beforeEnd, afterStart);
        if (existingSection !== text) {
          region.setLine(y, newLine);
        }
      }
    },
  };
}

// Keep Col class for backward compatibility (used by resolveFlexTree)
export class Col {
  private renderable: Renderable;
  private region: TerminalRegion;
  private options: ColOptions;
  
  constructor(region: TerminalRegion, content: string, options: ColOptions = {}) {
    this.region = region;
    this.options = options;
    this.renderable = createCol(region, content, options);
  }
  
  getPreferredWidth(): number { return this.renderable.getPreferredWidth(); }
  getMinWidth(): number { return this.renderable.getMinWidth(); }
  getMaxWidth(): number { return this.renderable.getMaxWidth(); }
  getHeight(): number { return this.renderable.getHeight(); }
  render(x: number, y: number, width: number): void { this.renderable.render(x, y, width); }
  get flexGrow(): number { return this.renderable.flexGrow; }
  get flexShrink(): number { return this.renderable.flexShrink; }
  
  /**
   * Update content (creates new renderable)
   */
  setContent(content: string): void {
    this.renderable = createCol(this.region, content, this.options);
  }
}

export interface ColOptions extends BaseComponentOptions {
  width?: number; // Fixed width (sets both min and max to this value)
  flex?: number; // Flex grow ratio (default: 0)
  min?: number; // Minimum width (default: content width)
  max?: number; // Maximum width (default: Infinity)
  overflow?: TextOverflow;
  bg?: string; // Background character to fill the column width (content is appended after bg)
  fill?: string; // Deprecated: use 'bg' instead (kept for backward compatibility)
}

