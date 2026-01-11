// Code debug component for displaying code errors/warnings with context

import type { RenderContext, Component } from '../component.js';
import { callComponent } from '../component.js';
import type { Color } from '../types.js';
import { applyStyle } from '../utils/colors.js';
import { stripAnsi, truncateToWidth, countVisibleChars } from '../utils/text.js';
import { fileLink } from '../utils/file-link.js';
import { Section } from './section.js';
import { Styled } from './styled.js';
import { grid as Grid } from '../layout/grid.js';
import { getLineNumberColor, isDarkTerminal } from '../utils/terminal-theme.js';

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
  /** Error or warning message (long message shown at top) */
  message: string;
  /** Error code/preamble to show before message (e.g., "eslint-plugin-unicorn(no-useless-length-check)") (optional) */
  errorCode?: string;
  /** Short message to show connected to underline (optional) */
  shortMessage?: string;
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
      errorCode,
      shortMessage,
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
    
    // Get appropriate line number color based on terminal theme (muted color)
    const lineNumberColor = getLineNumberColor(); // For line numbers (muted)
    
    // Calculate available width for code (reserve space for line numbers, separator, and spaces)
    // Calculate the maximum width needed for any line number that will be displayed
    const lineNumbersToCheck: number[] = [startLine];
    if (lineBefore !== null && lineBefore !== undefined) {
      lineNumbersToCheck.push(startLine - 1);
    }
    if (lineAfter !== null && lineAfter !== undefined) {
      lineNumbersToCheck.push(startLine + 1);
    }
    const lineNumWidth = Math.max(...lineNumbersToCheck.map(n => String(n).length));
    const codeAreaWidth = availableWidth - lineNumWidth - 3; // -3 for " │ " (space, pipe, space)
    
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
    
    // Build the code block lines
    const codeLines: string[] = [];
    
    // Icon and message at the top (Oxlint style)
    // Use grid to handle wrapping automatically
    const icon = type === 'error' ? '✖' : type === 'warning' ? '⚠' : 'ℹ';
    const iconStyled = applyStyle(icon, { color: colorScheme.message });
    
    // Build grid children: icon, optional error code, and message
    // Use Styled component to handle wrapping - it uses wrapText which prevents mid-word breaks
    const gridChildren: (string | Component)[] = [iconStyled];
    
    if (errorCode) {
      const errorCodeStyled = applyStyle(errorCode, { 
        color: colorScheme.message,
        underline: true,
        bold: true
      });
      gridChildren.push(errorCodeStyled + ': ');
    }
    
    const messageComponent = Styled(
      { color: colorScheme.message, overflow: 'wrap' },
      message
    );
    gridChildren.push(messageComponent);
    
    // Use grid: [icon, errorCode (if exists), message]
    // Template: [1, auto (if errorCode), '1*'] or [1, '1*']
    const template = errorCode ? [1, 'auto', '1*'] : [1, '1*'];
    const messageGrid = Grid({ template, columnGap: 1 }, ...gridChildren);
    
    const messageResult = callComponent(messageGrid, ctx);
    const messageLines: string[] = [];
    if (messageResult && typeof messageResult === 'string') {
      messageLines.push(messageResult);
    } else if (Array.isArray(messageResult)) {
      messageLines.push(...messageResult);
    } else {
      messageLines.push(iconStyled + ' ' + message);
    }
    
    codeLines.push(...messageLines);
    
    // Add blank line after message before code block
    codeLines.push('');
    
    // Filename in brackets with line:column, connected with curved border (Oxlint style)
    // The curve should align with the line number column (accounting for line number width)
    const pathText = baseDir && filePath.startsWith(baseDir)
      ? filePath.substring(baseDir.length + 1)
      : filePath;
    // Only make the filename blue/bold, not the brackets, colons, or line/column numbers
    const locationText = '[' + 
      applyStyle(pathText, { color: 'blue', bold: true }) + 
      ':' + 
      String(startLine) + 
      ':' + 
      String(startColumn) + 
      ']';
    // Align curve with line numbers: lineNumWidth spaces + 1 space (for the space after line number)
    const curveIndent = ' '.repeat(lineNumWidth + 1);
    const locationLine = curveIndent + applyStyle('╭─', { color: 'brightBlack' }) + locationText;
    codeLines.push(locationLine);
    
    // Line before (if exists)
    if (lineBefore !== null && lineBefore !== undefined) {
      const beforeLineNum = String(startLine - 1);
      const beforeLineNumPadded = beforeLineNum.padStart(lineNumWidth);
      const truncatedBefore = truncateToWidth(lineBefore, codeAreaWidth);
      codeLines.push(
        applyStyle(`${beforeLineNumPadded} `, { color: lineNumberColor, dim: isDarkTerminal() }) +
        applyStyle('│ ', { color: 'brightBlack' }) + truncatedBefore
      );
    }
    
    // Error line (with space before code)
    const errorLineNum = String(startLine);
    const errorLineNumPadded = errorLineNum.padStart(lineNumWidth);
    let errorLineDisplay = applyStyle(`${errorLineNumPadded} `, { color: lineNumberColor, dim: isDarkTerminal() }) +
      applyStyle('│ ', { color: 'brightBlack' }) + truncatedErrorLine;
    codeLines.push(errorLineDisplay);
    
    // Underline line (Oxlint style)
    // Format: "[lineNumWidth spaces][1 space][│][1 space][dots][underline]"
    // Calculate positions relative to the code (after "│ ")
    const underlineStartInCode = mapColumnToDisplay(startColumn);
    const underlineEndInCode = endColumn ? mapColumnToDisplay(endColumn) : underlineStartInCode;
    const underlineLength = underlineEndInCode - underlineStartInCode + 1;
    
    // Spaces to align with the start of the underline (position in code, 1-based, minus 1 for 0-based)
    const spacesBefore = Math.max(0, underlineStartInCode - 1);
    
    // Underline line: line number width + space + │ + space + spaces + underline
    let underlineLine = ' '.repeat(lineNumWidth) + ' ' + applyStyle('│', { color: 'brightBlack' }) + ' ';
    
    if (shortMessage && underlineLength > 1) {
      // Multi-character underline with T-bar in the middle for short message
      const connectPosInUnderline = Math.floor(underlineLength / 2);
      const leftPart = '─'.repeat(connectPosInUnderline);
      const rightPart = '─'.repeat(underlineLength - connectPosInUnderline - 1);
      underlineLine += ' '.repeat(spacesBefore) + 
        applyStyle(leftPart + '┬' + rightPart, { color: colorScheme.primary });
    } else if (shortMessage) {
      // Single character with T-bar for short message
      underlineLine += ' '.repeat(spacesBefore) + 
        applyStyle('┬', { color: colorScheme.primary });
    } else {
      // No short message, just underline the code
      const underlineChars = '─'.repeat(underlineLength);
      underlineLine += ' '.repeat(spacesBefore) + 
        applyStyle(underlineChars, { color: colorScheme.primary });
    }
    
    codeLines.push(underlineLine);
    
    // Short message connected to underline (if provided)
    if (shortMessage) {
      const connectCol = underlineLength > 1
        ? underlineStartInCode + Math.floor(underlineLength / 2)
        : underlineStartInCode;
      
      // Short message line: line number width + space + │ + space + spaces + connector + message
      const shortMessageLine = ' '.repeat(lineNumWidth) + ' ' + applyStyle('│', { color: 'brightBlack' }) + ' ' +
        ' '.repeat(Math.max(0, connectCol - 1)) +
        applyStyle('╰── ', { color: colorScheme.primary }) +
        applyStyle(shortMessage, { color: colorScheme.message });
      codeLines.push(shortMessageLine);
    }
    
    // Line after (if exists)
    if (lineAfter !== null && lineAfter !== undefined) {
      const afterLineNum = String(startLine + 1);
      const afterLineNumPadded = afterLineNum.padStart(lineNumWidth);
      const truncatedAfter = truncateToWidth(lineAfter, codeAreaWidth);
      codeLines.push(
        applyStyle(`${afterLineNumPadded} `, { color: lineNumberColor, dim: isDarkTerminal() }) +
        applyStyle('│ ', { color: 'brightBlack' }) + truncatedAfter
      );
    }
    
    // Bottom curve to close the box (Oxlint style)
    const bottomCurveIndent = ' '.repeat(lineNumWidth + 1);
    const bottomCurve = bottomCurveIndent + applyStyle('╰─', { color: 'brightBlack' });
    codeLines.push(bottomCurve);
    
    // Return lines directly (no Section wrapper for Oxlint style)
    return codeLines;
  };
}

