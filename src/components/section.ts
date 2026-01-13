// Section component - wraps content in a box with a tabbed title

import type { RenderContext, Component } from '../component.js';
import { renderChildren } from '../component.js';
import type { Color } from '../types.js';
import { applyStyle } from '../utils/colors.js';
import { autoColor } from '../utils/terminal-theme.js';

export interface SectionOptions {
  title: string;
  titleColor?: Color;
  borderColor?: Color;
  padding?: number; // Padding inside the box (default: 1)
  left?: boolean; // Show left border (default: true)
  right?: boolean; // Show right border (default: true)
  top?: boolean; // Show top border (default: true)
  bottom?: boolean; // Show bottom border (default: true)
}

/**
 * Section component - wraps content in a box with a tabbed title
 * 
 * The title appears in a "tab" at the top, and the content is wrapped in a box.
 * Uses rounded corners (╭ ╮ ╰ ╯) for a clean look. You can control which borders
 * are shown using `left`, `right`, `top`, and `bottom` options.
 * 
 * @example
 * // Default: all borders shown
 * Section({ title: 'My Section' }, ...)
 * 
 * @example
 * // Only left and right borders (no top/bottom)
 * Section({ title: 'My Section', top: false, bottom: false }, ...)
 * 
 * @example
 * // Only left border
 * Section({ title: 'My Section', right: false, top: false, bottom: false }, ...)
 */
export function Section(
  options: SectionOptions,
  ...children: Component[]
): Component {
  return (ctx: RenderContext) => {
    const {
      title,
      titleColor = 'accent',
      borderColor = 'muted',
      padding = 1,
      left = true,
      right = true,
      top = true,
      bottom = true,
    } = options;

    const availableWidth = ctx.availableWidth;
    const titleText = ` ${title} `;
    const titleWidth = titleText.length;
    
    // Calculate box width (full available width)
    const boxWidth = availableWidth;
    // Calculate content width: subtract borders and padding
    const borderWidth = (left ? 1 : 0) + (right ? 1 : 0);
    const contentWidth = Math.max(0, boxWidth - borderWidth - (padding * 2));
    
    // Render children - simple and clean!
    const contentLines = renderChildren(children, {
      ...ctx,
      availableWidth: contentWidth,
    });
    
    // Build the section with tab and box (even if empty)
    const lines: string[] = [];
    
    // Always use rounded corners when showing them
    const topLeftChar = '╭';
    const topRightChar = '╮';
    const bottomLeftChar = '╰';
    const bottomRightChar = '╯';
    
    const tabHorizontal = applyStyle('─', { color: borderColor });
    const vertical = applyStyle('│', { color: borderColor });
    const paddingSpaces = ' '.repeat(padding);
    
    // Top border/tab line: ╭─ Title ────────────────╮
    if (top) {
      const tabTitle = applyStyle(titleText, { color: titleColor });
      let tabLine = '';
      
      // Top-left corner: always shown when top line is visible (top is true here)
      // Also shown if left border is visible
      tabLine += applyStyle(topLeftChar, { color: borderColor });
      
      // Title
      tabLine += tabTitle;
      
      // Horizontal line after title
      const spaceAfterTitle = Math.max(0, boxWidth - titleWidth - 1 - 1); // minus both corners
      tabLine += tabHorizontal.repeat(spaceAfterTitle);
      
      // Top-right corner: always shown when top line is visible (top is true here)
      // Also shown if right border is visible
      tabLine += applyStyle(topRightChar, { color: borderColor });
      
      lines.push(tabLine);
    }
    
    // Calculate which line is first and last (excluding top/bottom border lines)
    const totalContentLines = padding + contentLines.length + padding;
    let lineIndex = 0;
    
    // Top padding: empty lines with borders
    for (let i = 0; i < padding; i++) {
      const isFirstLine = lineIndex === 0;
      const isLastLine = lineIndex === totalContentLines - 1;
      let line = '';
      
      // Left border: show top-left corner on first line if left is visible (unless top already added it)
      if (left && isFirstLine && !top) {
        line += applyStyle(topLeftChar, { color: borderColor });
      } else if (left && isLastLine && !bottom) {
        // Left border: show bottom-left corner on last line if left is visible (unless bottom already added it)
        line += applyStyle(bottomLeftChar, { color: borderColor });
      } else if (left) {
        line += vertical;
      }
      
      line += paddingSpaces + ' '.repeat(contentWidth) + paddingSpaces;
      
      // Right border: show top-right corner on first line if right is visible (unless top already added it)
      if (right && isFirstLine && !top) {
        line += applyStyle(topRightChar, { color: borderColor });
      } else if (right && isLastLine && !bottom) {
        // Right border: show bottom-right corner on last line if right is visible (unless bottom already added it)
        line += applyStyle(bottomRightChar, { color: borderColor });
      } else if (right) {
        line += vertical;
      }
      
      lines.push(line);
      lineIndex++;
    }
    
    // Content lines - children already know their available width
    for (let i = 0; i < contentLines.length; i++) {
      const isFirstLine = lineIndex === 0;
      const isLastLine = lineIndex === totalContentLines - 1;
      const contentLine = contentLines[i];
      let line = '';
      
      // Left border: show top-left corner on first line if left is visible (unless top already added it)
      if (left && isFirstLine && !top) {
        line += applyStyle(topLeftChar, { color: borderColor });
      } else if (left && isLastLine && !bottom) {
        // Left border: show bottom-left corner on last line if left is visible (unless bottom already added it)
        line += applyStyle(bottomLeftChar, { color: borderColor });
      } else if (left) {
        line += vertical;
      }
      
      line += paddingSpaces + contentLine + paddingSpaces;
      
      // Right border: show top-right corner on first line if right is visible (unless top already added it)
      if (right && isFirstLine && !top) {
        line += applyStyle(topRightChar, { color: borderColor });
      } else if (right && isLastLine && !bottom) {
        // Right border: show bottom-right corner on last line if right is visible (unless bottom already added it)
        line += applyStyle(bottomRightChar, { color: borderColor });
      } else if (right) {
        line += vertical;
      }
      
      lines.push(line);
      lineIndex++;
    }
    
    // Bottom padding: empty lines with borders
    for (let i = 0; i < padding; i++) {
      const isFirstLine = lineIndex === 0;
      const isLastLine = lineIndex === totalContentLines - 1;
      let line = '';
      
      // Left border: show top-left corner on first line if left is visible (unless top already added it)
      if (left && isFirstLine && !top) {
        line += applyStyle(topLeftChar, { color: borderColor });
      } else if (left && isLastLine && !bottom) {
        // Left border: show bottom-left corner on last line if left is visible (unless bottom already added it)
        line += applyStyle(bottomLeftChar, { color: borderColor });
      } else if (left) {
        line += vertical;
      }
      
      line += paddingSpaces + ' '.repeat(contentWidth) + paddingSpaces;
      
      // Right border: show top-right corner on first line if right is visible (unless top already added it)
      if (right && isFirstLine && !top) {
        line += applyStyle(topRightChar, { color: borderColor });
      } else if (right && isLastLine && !bottom) {
        // Right border: show bottom-right corner on last line if right is visible (unless bottom already added it)
        line += applyStyle(bottomRightChar, { color: borderColor });
      } else if (right) {
        line += vertical;
      }
      
      lines.push(line);
      lineIndex++;
    }
    
    // Bottom border: ╰───────────────────────╯
    if (bottom) {
      let bottomLine = '';
      
      // Bottom-left corner: always shown when bottom line is visible
      bottomLine += applyStyle(bottomLeftChar, { color: borderColor });
      
      // Horizontal line
      const horizontalWidth = Math.max(0, boxWidth - 1 - 1); // minus both corners
      bottomLine += tabHorizontal.repeat(horizontalWidth);
      
      // Bottom-right corner: always shown when bottom line is visible
      bottomLine += applyStyle(bottomRightChar, { color: borderColor });
      
      lines.push(bottomLine);
    }
    
    return lines;
  };
}

