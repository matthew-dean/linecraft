// Simple interface for renderable components
// Only complex components (with wrapping, nested flex, etc.) need to implement this
// Simple strings are handled directly by flex

import type { TerminalRegion } from '../region';
import { wrapText, truncateEnd, truncateStart, truncateMiddle } from '../utils/text';

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
  options: { flexGrow?: number; flexShrink?: number; minWidth?: number; maxWidth?: number; overflow?: 'none' | 'ellipsis-end' | 'ellipsis-start' | 'ellipsis-middle' | 'wrap' } = {}
): Renderable {
  if (typeof child === 'string') {
    // Simple string - create a lightweight renderable
    // With auto-wrap disabled globally, we must handle wrapping ourselves
    const text = child;
    const textWidth = measureString(text);
    const overflow = options.overflow ?? 'wrap'; // Default to wrap for strings in flex
    
    return {
      flexGrow: options.flexGrow ?? 0,
      flexShrink: options.flexShrink ?? 1,
      getPreferredWidth: () => textWidth,
      getMinWidth: () => options.minWidth ?? textWidth,
      getMaxWidth: () => options.maxWidth ?? Infinity,
      getHeight: function() {
        // If wrapping, calculate height based on width
        // Note: width is only known during render, so we estimate based on maxWidth
        if (overflow === 'wrap') {
          const estimatedWidth = options.maxWidth ?? textWidth;
          if (estimatedWidth > 0 && estimatedWidth < textWidth) {
            const plainText = stripAnsiCodes(text);
            const lines = wrapText(plainText, estimatedWidth);
            return lines.length;
          }
        }
        return 1;
      },
      render: function(x: number, y: number, width: number) {
        // Handle wrapping for strings (since auto-wrap is disabled globally)
        if (overflow === 'wrap') {
          const plainText = stripAnsiCodes(text);
          const lines = wrapText(plainText, width);
          
          // Render each wrapped line, aligned at x position
          for (let i = 0; i < lines.length; i++) {
            const wrappedLine = lines[i];
            const padded = wrappedLine.padEnd(width, ' ');
            
            // Get existing line and merge at x position
            const existingLine = region.getLine(y + i) || '';
            const existingPlain = existingLine.replace(/\x1b\[[0-9;]*m/g, '');
            const existingVisualWidth = existingPlain.length;
            
            if (x === 0 && existingVisualWidth === 0) {
              // Starting at beginning with empty line - just set it
              region.setLine(y + i, padded);
            } else {
              // Merge logic (same as col)
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
              
              if (existingVisualWidth < x) {
                const padding = x - existingVisualWidth;
                const newLine = existingLine + ' '.repeat(padding) + padded;
                region.setLine(y + i, newLine);
              } else {
                const beforeEnd = findCharPosForVisual(existingLine, x);
                let afterStart: number;
                if (existingVisualWidth <= x + width) {
                  afterStart = existingLine.length;
                } else {
                  afterStart = findCharPosForVisual(existingLine, x + width);
                }
                
                const before = existingLine.slice(0, beforeEnd);
                const after = existingLine.slice(afterStart);
                const newLine = before + padded + after;
                
                const existingSection = existingLine.slice(beforeEnd, afterStart);
                if (existingSection !== padded) {
                  region.setLine(y + i, newLine);
                }
              }
            }
          }
          return;
        }
        
        // Handle non-wrapping overflow modes (ellipsis, etc.)
        let displayText = text;
        const plainText = stripAnsiCodes(text);
        
        if (overflow === 'ellipsis-end' && plainText.length > width) {
          displayText = truncateEnd(plainText, width);
        } else if (overflow === 'ellipsis-start' && plainText.length > width) {
          displayText = truncateStart(plainText, width);
        } else if (overflow === 'ellipsis-middle' && plainText.length > width) {
          displayText = truncateMiddle(plainText, width);
        }
        
        const padding = width - stripAnsiCodes(displayText).length;
        const padded = padding > 0 ? displayText + ' '.repeat(padding) : displayText;
        
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
