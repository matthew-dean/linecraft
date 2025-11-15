// Simple interface for renderable components
// Only complex components (with wrapping, nested flex, etc.) need to implement this
// Simple strings are handled directly by flex

import type { TerminalRegion } from '../region.js';

/**
 * Interface for complex components that need measurement logic
 * Simple strings don't need this - flex measures them directly
 */
export interface Renderable {
  getPreferredWidth(): number;
  getMinWidth(): number;
  getMaxWidth(): number;
  getHeight(): number;
  render(x: number, y: number, width: number): void;
  readonly flexGrow: number;
  readonly flexShrink: number;
}

/**
 * A flex child can be a string, Renderable, array of either (for functional components),
 * or a descriptor (ColDescriptor, FlexDescriptor)
 */
export type FlexChild = string | Renderable | Array<string | Renderable>;

/**
 * Helper to strip ANSI codes for width measurement
 */
export function stripAnsiCodes(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Measure a string (strips ANSI codes)
 */
export function measureString(text: string): number {
  return stripAnsiCodes(text).length;
}

/**
 * Flatten an array of flex children, handling nested arrays
 */
export function flattenChildren(children: FlexChild[]): Array<string | Renderable> {
  const result: Array<string | Renderable> = [];
  for (const child of children) {
    if (Array.isArray(child)) {
      result.push(...flattenChildren(child));
    } else {
      result.push(child);
    }
  }
  return result;
}

/**
 * Convert a flex child to a Renderable (strings become simple renderables)
 */
export function toRenderable(
  region: TerminalRegion,
  child: string | Renderable,
  options: { flexGrow?: number; flexShrink?: number; minWidth?: number; maxWidth?: number } = {}
): Renderable {
  if (typeof child === 'string') {
    // Simple string - create a lightweight renderable
    const text = child;
    const textWidth = measureString(text);
    return {
      flexGrow: options.flexGrow ?? 0,
      flexShrink: options.flexShrink ?? 1,
      getPreferredWidth: () => textWidth,
      getMinWidth: () => options.minWidth ?? textWidth,
      getMaxWidth: () => options.maxWidth ?? Infinity,
      getHeight: () => 1,
      render: (x: number, y: number, width: number) => {
        // Use the same merge logic as Col to properly merge with existing content
        const plainText = stripAnsiCodes(text);
        const padding = width - plainText.length;
        const padded = padding > 0 ? text + ' '.repeat(padding) : text;
        
        // Get existing line and merge at x position
        const existingLine = region.getLine(y) || '';
        const existingPlain = existingLine.replace(/\x1b\[[0-9;]*m/g, '');
        const existingVisualWidth = existingPlain.length;
        
        if (x === 0 && existingVisualWidth === 0) {
          // Starting at beginning with empty line - just set it
          region.setLine(y, padded);
        } else {
          // Need to merge: before + text + after
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
          
          // If existing line is shorter than x, we need to pad it first
          if (existingVisualWidth < x) {
            // Pad existing line to x position, then append our text
            const padding = x - existingVisualWidth;
            const newLine = existingLine + ' '.repeat(padding) + padded;
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
          
          const beforeEnd = findCharPosForVisual(existingLine, x);
          const before = existingLine.slice(0, beforeEnd);
          const after = existingLine.slice(afterStart);
          
          // Build new line
          const newLine = before + padded + after;
          
          // Only update if the section we're replacing actually changed
          const existingSection = existingLine.slice(beforeEnd, afterStart);
          if (existingSection !== padded) {
            region.setLine(y, newLine);
          }
        }
      },
    };
  }
  return child;
}
