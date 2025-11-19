// Section component - wraps content in a box with a tabbed title

import type { RenderContext, Component } from '../component';
import { renderChildren } from '../component';
import type { Color } from '../types';
import { applyStyle } from '../utils/colors';

export interface SectionOptions {
  title: string;
  titleColor?: Color;
  borderColor?: Color;
  padding?: number; // Padding inside the box (default: 1)
}

/**
 * Section component - wraps content in a rounded box with a tabbed title
 * 
 * The title appears in a "tab" at the top, and the content is wrapped in a rounded box.
 * Uses modern rounded corners (╭ ╮ ╰ ╯) for a clean look.
 */
export function Section(
  options: SectionOptions,
  ...children: Component[]
): Component {
  return (ctx: RenderContext) => {
    const {
      title,
      titleColor = 'brightCyan',
      borderColor = 'brightBlack',
      padding = 1,
    } = options;

    const availableWidth = ctx.availableWidth;
    const titleText = ` ${title} `;
    const titleWidth = titleText.length;
    
    // Calculate box width (full available width)
    const boxWidth = availableWidth;
    const contentWidth = Math.max(0, boxWidth - 2 - (padding * 2)); // minus borders and padding
    
    // Render children - simple and clean!
    const contentLines = renderChildren(children, {
      ...ctx,
      availableWidth: contentWidth,
    });
    
    // Build the section with tab and box (even if empty)
    const lines: string[] = [];
    
    // Tab line: ╭─ Title ────────────────╮
    const tabTopLeft = applyStyle('╭', { color: borderColor });
    const tabTopRight = applyStyle('╮', { color: borderColor });
    const tabHorizontal = applyStyle('─', { color: borderColor });
    const tabTitle = applyStyle(titleText, { color: titleColor });
    
    // Calculate space after title
    const spaceAfterTitle = Math.max(0, boxWidth - titleWidth - 2); // minus corners
    const tabLine = tabTopLeft + tabTitle + tabHorizontal.repeat(spaceAfterTitle) + tabTopRight;
    lines.push(tabLine);
    
    // Content lines with borders
    const vertical = applyStyle('│', { color: borderColor });
    const paddingSpaces = ' '.repeat(padding);
    const emptyContentLine = vertical + paddingSpaces + ' '.repeat(contentWidth) + paddingSpaces + vertical;
    
    // Top padding: empty lines with borders
    for (let i = 0; i < padding; i++) {
      lines.push(emptyContentLine);
    }
    
    // Content lines - children already know their available width
    for (const contentLine of contentLines) {
      lines.push(vertical + paddingSpaces + contentLine + paddingSpaces + vertical);
    }
    
    // Bottom padding: empty lines with borders
    for (let i = 0; i < padding; i++) {
      lines.push(emptyContentLine);
    }
    
    // Bottom border: ╰───────────────────────╯
    const bottomLeft = applyStyle('╰', { color: borderColor });
    const bottomRight = applyStyle('╯', { color: borderColor });
    const bottomLine = bottomLeft + tabHorizontal.repeat(Math.max(0, boxWidth - 2)) + bottomRight;
    lines.push(bottomLine);
    
    return lines;
  };
}

