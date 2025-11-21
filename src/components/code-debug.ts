// Code debug component for displaying code errors/warnings with context

import type { RenderContext, Component } from '../component';
import { callComponent } from '../component';
import type { Color } from '../types';
import { applyStyle } from '../utils/colors';
import { truncateEnd, truncateStart, wrapText, stripAnsi, truncateToWidth } from '../utils/text';
import { fileLink } from '../utils/file-link';
import { Section } from './section';
import { getLineNumberColor } from '../utils/terminal-theme';

export type CodeDebugType = 'error' | 'warning' | 'info';

export interface CodeDebugOptions {
  /** Line number where error starts (1-based) */
  startLine: number;
  /** Column number where error starts (1-based) */
  startColumn: number;
  /** Line number where error ends (1-based, optional) */
  endLine?: number;
  /** Column number where error ends (1-based, optional) */
  endColumn?: number;
  /** Source code line before the error line (optional) */
  lineBefore?: string | null;
  /** Source code line with the error */
  errorLine: string;
  /** Source code line after the error line (optional) */
  lineAfter?: string | null;
  /** Error or warning message */
  message: string;
  /** Short file path to display */
  filePath: string;
  /** Full resolved file path for clickable link */
  fullPath: string;
  /** Base directory for relative paths (optional) */
  baseDir?: string;
  /** Type of error: error, warning, or info */
  type?: CodeDebugType;
  /** Maximum column to show before forcing ellipsis (to make room for message) */
  maxColumn?: number;
}

/**
 * Calculate which columns are visible when code is truncated with ellipsis
 */
interface VisibleRange {
  startCol: number;  // First visible column (1-based)
  endCol: number;    // Last visible column (1-based)
  hasEllipsisStart: boolean;
  hasEllipsisEnd: boolean;
}

function calculateVisibleRange(
  code: string,
  availableWidth: number,
  targetStartCol: number,
  targetEndCol: number | undefined,
  maxColumn?: number
): VisibleRange {
  const plainCode = stripAnsi(code);
  const codeLength = plainCode.length;
  
  // If code fits, show everything
  if (codeLength <= availableWidth) {
    return {
      startCol: 1,
      endCol: codeLength,
      hasEllipsisStart: false,
      hasEllipsisEnd: false,
    };
  }
  
  // If maxColumn is set, we need to ensure we don't show beyond it
  const effectiveMaxCol = maxColumn ? Math.min(maxColumn, codeLength) : codeLength;
  
  // Calculate how much space we need for the target columns
  const targetWidth = targetEndCol 
    ? targetEndCol - targetStartCol + 1
    : 1; // Just the arrow
  
  // If target doesn't fit, we'll need to truncate
  if (targetWidth > availableWidth - 6) { // -6 for ellipsis on both sides if needed
    // Target is too wide, just show middle with ellipsis
    const midPoint = Math.floor((availableWidth - 6) / 2);
    const startCol = Math.max(1, targetStartCol - midPoint);
    const endCol = Math.min(effectiveMaxCol, startCol + availableWidth - 6);
    return {
      startCol,
      endCol,
      hasEllipsisStart: startCol > 1,
      hasEllipsisEnd: endCol < codeLength,
    };
  }
  
  // Try to center the target in the available space
  const padding = Math.floor((availableWidth - targetWidth) / 2);
  let startCol = Math.max(1, targetStartCol - padding);
  let endCol = Math.min(effectiveMaxCol, startCol + availableWidth - 1);
  
  // Adjust if we hit boundaries
  if (endCol - startCol + 1 > availableWidth) {
    endCol = startCol + availableWidth - 1;
  }
  if (endCol > effectiveMaxCol) {
    endCol = effectiveMaxCol;
    startCol = Math.max(1, endCol - availableWidth + 1);
  }
  if (startCol < 1) {
    startCol = 1;
    endCol = Math.min(effectiveMaxCol, availableWidth);
  }
  
  // Check if we need ellipsis
  const hasEllipsisStart = startCol > 1;
  const hasEllipsisEnd = endCol < codeLength;
  
  return {
    startCol,
    endCol,
    hasEllipsisStart,
    hasEllipsisEnd,
  };
}

/**
 * Truncate code line to show specific column range with ellipsis
 */
function truncateCodeLine(
  code: string,
  visibleRange: VisibleRange,
  availableWidth: number
): string {
  const { startCol, endCol, hasEllipsisStart, hasEllipsisEnd } = visibleRange;
  const plainCode = stripAnsi(code);
  
  if (!hasEllipsisStart && !hasEllipsisEnd) {
    // No truncation needed, but ensure it fits
    return truncateToWidth(code, availableWidth);
  }
  
  // Extract the visible portion (1-based columns in plain text)
  const visiblePlain = plainCode.substring(startCol - 1, endCol);
  
  // Calculate available width for code (minus ellipsis)
  const ellipsisWidth = (hasEllipsisStart ? 3 : 0) + (hasEllipsisEnd ? 3 : 0);
  const codeWidth = availableWidth - ellipsisWidth;
  
  // Truncate the visible portion if it's still too wide
  let truncatedPlain = visiblePlain;
  if (stripAnsi(visiblePlain).length > codeWidth) {
    truncatedPlain = truncateToWidth(visiblePlain, codeWidth);
  }
  
  if (hasEllipsisStart && hasEllipsisEnd) {
    // Truncate both ends - show middle portion
    const midPoint = Math.floor(codeWidth / 2);
    const startPart = truncateToWidth(truncatedPlain, midPoint);
    const endPart = truncateToWidth(
      truncatedPlain.substring(stripAnsi(truncatedPlain).length - (codeWidth - midPoint)),
      codeWidth - midPoint
    );
    return `...${startPart}...${endPart}...`;
  } else if (hasEllipsisStart) {
    return `...${truncatedPlain}`;
  } else {
    return `${truncatedPlain}...`;
  }
}

/**
 * CodeDebug component - displays code errors/warnings with context
 */
export function CodeDebug(options: CodeDebugOptions): Component {
  return (ctx: RenderContext) => {
    const {
      startLine,
      startColumn,
      endLine,
      endColumn,
      lineBefore,
      errorLine,
      lineAfter,
      message,
      filePath,
      fullPath,
      baseDir,
      type = 'error',
      maxColumn,
    } = options;
    
    const availableWidth = ctx.availableWidth;
    
    // Color scheme based on type
    const colors: Record<CodeDebugType, { primary: Color; secondary: Color; message: Color }> = {
      error: { primary: 'red', secondary: 'brightRed', message: 'brightRed' },
      warning: { primary: 'yellow', secondary: 'brightYellow', message: 'brightYellow' },
      info: { primary: 'cyan', secondary: 'brightCyan', message: 'brightCyan' },
    };
    const colorScheme = colors[type];
    
    // Get appropriate line number color based on terminal theme
    const lineNumberColor = getLineNumberColor();
    
    // Calculate available width for code (reserve space for line numbers and 2 spaces)
    const lineNumWidth = Math.max(
      String(startLine + 1).length,
      String(startLine).length,
      lineBefore !== null && lineBefore !== undefined ? String(startLine - 1).length : 0,
      lineAfter !== null && lineAfter !== undefined ? String(startLine + 1).length : 0
    );
    const codeAreaWidth = availableWidth - lineNumWidth - 2; // -2 for "  " (2 spaces)
    
    // Calculate visible range for error line
    const targetEndCol = endColumn ?? startColumn;
    const plainErrorLine = stripAnsi(errorLine);
    const effectiveMaxCol = maxColumn ? Math.min(maxColumn, plainErrorLine.length) : plainErrorLine.length;
    const visibleRange = calculateVisibleRange(
      errorLine,
      codeAreaWidth,
      startColumn,
      targetEndCol,
      effectiveMaxCol
    );
    
    // Truncate error line
    const truncatedErrorLine = truncateCodeLine(errorLine, visibleRange, codeAreaWidth);
    
    // Calculate arrow/underline position relative to the truncated error line display
    // Map original column positions to display positions
    const truncatedPlain = stripAnsi(truncatedErrorLine);
    
    // Helper to map original column to display position
    const mapColumnToDisplay = (originalCol: number): number => {
      if (visibleRange.hasEllipsisStart && visibleRange.hasEllipsisEnd) {
        // Format: "...start...end..."
        // Visible range is in the middle
        if (originalCol < visibleRange.startCol) {
          return 1; // Before visible, point to start
        } else if (originalCol > visibleRange.endCol) {
          return truncatedPlain.length; // After visible, point to end
        } else {
          // In visible range: position = 4 (for "...") + (col - startCol + 1)
          return 4 + (originalCol - visibleRange.startCol);
        }
      } else if (visibleRange.hasEllipsisStart) {
        // Format: "...code"
        if (originalCol < visibleRange.startCol) {
          return 1;
        } else {
          return 4 + (originalCol - visibleRange.startCol);
        }
      } else if (visibleRange.hasEllipsisEnd) {
        // Format: "code..."
        if (originalCol > visibleRange.endCol) {
          return truncatedPlain.length;
        } else {
          return originalCol;
        }
      } else {
        // No ellipsis, direct mapping
        return originalCol;
      }
    };
    
    const arrowCol = mapColumnToDisplay(startColumn);
    let underlineStartCol = arrowCol;
    let underlineEndCol = arrowCol;
    
    if (endColumn) {
      underlineStartCol = mapColumnToDisplay(startColumn);
      underlineEndCol = mapColumnToDisplay(endColumn);
      // Ensure valid range
      if (underlineEndCol < underlineStartCol) {
        underlineEndCol = underlineStartCol;
      }
    }
    
    // Build the code block lines (will be wrapped in Section)
    const codeLines: string[] = [];
    
    // Title line: "Error in {filename}" or type-specific title
    const pathText = baseDir && filePath.startsWith(baseDir)
      ? filePath.substring(baseDir.length + 1)
      : filePath;
    const errorTypeTitle = type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Info';
    const titleLine = applyStyle(`${errorTypeTitle} in ${pathText}`, { color: colorScheme.secondary, bold: true });
    codeLines.push(titleLine);
    
    // Line before (if exists)
    if (lineBefore !== null && lineBefore !== undefined) {
      const beforeLineNum = String(startLine - 1);
      const beforeLineNumPadded = beforeLineNum.padStart(lineNumWidth);
      const truncatedBefore = truncateToWidth(lineBefore, codeAreaWidth);
      codeLines.push(
        applyStyle(`${beforeLineNumPadded}  `, { color: lineNumberColor }) +
        truncatedBefore
      );
    }
    
    // Error line
    const errorLineNum = String(startLine);
    const errorLineNumPadded = errorLineNum.padStart(lineNumWidth);
    let errorLineDisplay = applyStyle(`${errorLineNumPadded}  `, { color: lineNumberColor }) +
      truncatedErrorLine;
    codeLines.push(errorLineDisplay);
    
    // Arrow/underline line
    let indicatorLine = ' '.repeat(lineNumWidth) + '  ';
    indicatorLine += ' '.repeat(Math.max(0, arrowCol - 1));
    
    // Calculate where the connecting line should come down from (middle of underline or arrow position)
    const connectCol = endColumn && underlineEndCol > underlineStartCol
      ? Math.floor((underlineStartCol + underlineEndCol) / 2) // Middle of underline
      : arrowCol; // Position of arrow
    
    if (endColumn && underlineEndCol > underlineStartCol) {
      // Underline with curved edges facing up and T-bar in the middle: ╰──┬──╯
      const underlineLength = underlineEndCol - underlineStartCol;
      const connectPosInUnderline = connectCol - underlineStartCol; // Position within the underline
      
      if (underlineLength >= 3) {
        // Build underline with T-bar: left curve, dashes, T-bar, dashes, right curve
        const leftPart = '─'.repeat(Math.max(0, connectPosInUnderline - 1));
        const rightPart = '─'.repeat(Math.max(0, underlineLength - connectPosInUnderline - 1));
        indicatorLine += applyStyle('┖' + leftPart + '┬' + rightPart + '┚', { color: colorScheme.primary });
      } else if (underlineLength === 2) {
        // Too short for T-bar, just use T in middle
        indicatorLine += applyStyle('┖┬┚', { color: colorScheme.primary });
      } else {
        // Single character, just use T
        indicatorLine += applyStyle('╿', { color: colorScheme.primary });
      }
    } else {
      // Single point - use ┬ (T pointing up) which has horizontal bar pointing to code, vertical line going down
      indicatorLine += applyStyle('╿', { color: colorScheme.primary });
    }
    
    codeLines.push(indicatorLine);
    
    // Horizontal line to message (directly from T-bar or ┴, no extra vertical line)
    const horizontalLine = ' '.repeat(lineNumWidth) + '  ';
    const horizontalSpaces = ' '.repeat(Math.max(0, connectCol - 1));
    const horizontalBar = applyStyle('└', { color: colorScheme.primary });
    const horizontalDash = applyStyle('─ ', { color: colorScheme.primary });
    const messageStart = horizontalLine + horizontalSpaces + horizontalBar + horizontalDash;
    
    // Message lines
    const messageWidth = availableWidth - stripAnsi(messageStart).length;
    const messageLines = wrapText(message, messageWidth);
    
    // First message line with connecting line
    if (messageLines.length > 0) {
      codeLines.push(
        messageStart +
        applyStyle(messageLines[0], { color: colorScheme.message })
      );
      
      // Remaining message lines (indented to start of first line)
      const messageIndent = ' '.repeat(stripAnsi(messageStart).length);
      for (let i = 1; i < messageLines.length; i++) {
        codeLines.push(messageIndent + applyStyle(messageLines[i], { color: colorScheme.message }));
      }
    }
    
    // Line after (if exists) - comes after the message
    if (lineAfter !== null && lineAfter !== undefined) {
      // Add empty line after message (within section)
      codeLines.push('');
      
      const afterLineNum = String(startLine + 1);
      const afterLineNumPadded = afterLineNum.padStart(lineNumWidth);
      const truncatedAfter = truncateToWidth(lineAfter, codeAreaWidth);
      codeLines.push(
        applyStyle(`${afterLineNumPadded}  `, { color: lineNumberColor }) +
        truncatedAfter
      );
      
      // Add another empty line after line after (within section)
      codeLines.push('');
    }
    
    // Wrap in Section with left border only, no padding
    const filePathDisplay = (() => {
      const pathText = baseDir && filePath.startsWith(baseDir)
        ? filePath.substring(baseDir.length + 1)
        : filePath;
      const pathWithLink = fileLink(fullPath, pathText);
      const lineNumText = `:${startLine}${endLine && endLine !== startLine ? `:${endLine}` : ''}`;
      return pathWithLink + lineNumText;
    })();
    
    // Use Section to wrap the code block with left border
    const sectionComponent = Section(
      {
        title: filePathDisplay,
        titleColor: colorScheme.secondary,
        left: true,
        right: false,
        top: false,
        bottom: false,
        padding: 0,
        borderColor: colorScheme.primary,
      },
      (ctx: RenderContext) => codeLines
    );
    
    return callComponent(sectionComponent, ctx);
  };
}

