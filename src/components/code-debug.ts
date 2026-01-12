// Code debug component for displaying code errors/warnings with context

import type { RenderContext, Component } from '../component.js';
import { callComponent } from '../component.js';
import type { Color } from '../types.js';
import { applyStyle } from '../utils/colors.js';
import { stripAnsi, truncateToWidth, countVisibleChars, splitAtVisiblePos } from '../utils/text.js';
import { fileLink } from '../utils/file-link.js';
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
  // First, determine if we'll need ellipsis on both sides
  const willNeedEllipsisStart = targetStartCol > 1 || (targetStartCol === 1 && codeLength > availableWidth);
  const willNeedEllipsisEnd = (targetEndCol ?? targetStartCol) < codeLength || codeLength > availableWidth;
  const ellipsisWidth = (willNeedEllipsisStart ? 3 : 0) + (willNeedEllipsisEnd ? 3 : 0);
  const effectiveAvailableWidth = availableWidth - ellipsisWidth;
  
  const padding = Math.floor((effectiveAvailableWidth - targetWidth) / 2);
  let startCol = Math.max(1, targetStartCol - padding);
  let endCol = Math.min(effectiveMaxCol, startCol + effectiveAvailableWidth - 1);
  
  // Adjust if we hit boundaries
  if (endCol - startCol + 1 > effectiveAvailableWidth) {
    endCol = startCol + effectiveAvailableWidth - 1;
  }
  if (endCol > effectiveMaxCol) {
    endCol = effectiveMaxCol;
    startCol = Math.max(1, endCol - effectiveAvailableWidth + 1);
  }
  if (startCol < 1) {
    startCol = 1;
    endCol = Math.min(effectiveMaxCol, effectiveAvailableWidth);
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
    // Truncate both ends - show the visible range portion (no middle ellipsis)
    // The visible range already contains the target columns, just truncate if needed
    return `...${truncatedPlain}...`;
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
    
    // If availableWidth is Infinity (during Grid measurement), use a reasonable default
    // Otherwise use the actual available width
    const availableWidth = Number.isFinite(ctx.availableWidth) ? ctx.availableWidth : 80;
    
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
    
    // Build the combined message text: errorCode (if present) + message
    // The errorCode should be underlined and bold, followed by ": ", then the message
    // All parts should have the message color
    let messageText: string;
    if (errorCode) {
      const errorCodeStyled = applyStyle(errorCode, { 
        color: colorScheme.message,
        underline: true,
        bold: true
      });
      // Apply message color to ": " and message parts so they maintain color after errorCode's reset
      const colonAndMessage = applyStyle(': ' + message, { color: colorScheme.message });
      messageText = errorCodeStyled + colonAndMessage;
    } else {
      messageText = message;
    }
    
    // Use Styled component to handle wrapping - it uses wrapText which prevents mid-word breaks
    // Note: messageText may already have ANSI codes, so Styled will preserve them
    const messageComponent = Styled(
      { color: colorScheme.message, overflow: 'wrap' },
      messageText
    );
    
    // Use 2-column grid: [icon, message (with optional errorCode)]
    const messageGrid = Grid({ template: [1, '1*'], columnGap: 1 }, iconStyled, messageComponent);
    
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
    const pathText = baseDir && filePath.startsWith(baseDir)
      ? filePath.substring(baseDir.length + 1)
      : filePath;
    
    // Build location line parts
    const curveIndent = ' '.repeat(lineNumWidth + 1);
    const curve = applyStyle('╭─', { color: 'brightBlack' });
    const bracketOpen = '[';
    const colon1 = ':';
    // Apply subtle color to line/column numbers (not colons)
    const lineNumColor = isDarkTerminal() ? 'magenta' : 'magenta';
    const lineNum = applyStyle(String(startLine), { color: lineNumColor });
    const colon2 = ':';
    const colNum = applyStyle(String(startColumn), { color: lineNumColor });
    const bracketClose = ']';
    
    // Calculate max width for path: available width minus fixed parts
    // Fixed parts: curveIndent + ╭─ + [ + : + lineNum + : + colNum + ]
    // Note: lineNum and colNum are now styled, so we need to use plain strings for width calculation
    const lineNumPlain = String(startLine);
    const colNumPlain = String(startColumn);
    const fixedParts = curveIndent + curve + bracketOpen + colon1 + lineNumPlain + colon2 + colNumPlain + bracketClose;
    const fixedPartsWidth = countVisibleChars(fixedParts);
    // Ensure pathMaxWidth is finite and reasonable (cap at 40 to prevent extremely long paths)
    const pathMaxWidth = Math.max(10, Math.min(40, availableWidth - fixedPartsWidth));
    
    // Create clickable file link with styling and max width constraint
    const pathWithLink = fileLink(fullPath, pathText);
    const pathStyled = Styled(
      { color: 'blue', bold: true, overflow: 'ellipsis-start', max: pathMaxWidth },
      pathWithLink
    );
    
    // Use Grid with auto columns (content-based width, no padding)
    // Template: [curveIndent (auto)][╭─ (auto)][[ (auto)][path (auto)][: (auto)][line (auto)][: (auto)][column (auto)][] (auto)]
    const locationGrid = Grid(
      { 
        template: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
        columnGap: 0
      },
      curveIndent,
      curve,
      bracketOpen,
      pathStyled,
      colon1,
      lineNum,
      colon2,
      colNum,
      bracketClose
    );
    
    const locationResult = callComponent(locationGrid, ctx);
    
    if (locationResult && typeof locationResult === 'string') {
      codeLines.push(locationResult);
    } else if (Array.isArray(locationResult)) {
      codeLines.push(...locationResult);
    } else {
      // Fallback
      const locationLine = curveIndent + curve + bracketOpen + pathText + colon1 + lineNum + colon2 + colNum + bracketClose;
      codeLines.push(locationLine);
    }
    
    // Line before (if exists)
    if (lineBefore !== null && lineBefore !== undefined) {
      const beforeLineNum = String(startLine - 1);
      const beforeLineNumPadded = beforeLineNum.padStart(lineNumWidth);
      const truncatedBefore = truncateToWidth(lineBefore, codeAreaWidth);
      // Make non-error lines slightly dimmer: darker on dark terminals, whiter on light terminals
      const dimmedBefore = isDarkTerminal() 
        ? applyStyle(truncatedBefore, { dim: true })
        : applyStyle(truncatedBefore, { color: 'brightBlack' });
      codeLines.push(
        applyStyle(`${beforeLineNumPadded} `, { color: lineNumberColor, dim: isDarkTerminal() }) +
        applyStyle('│ ', { color: 'brightBlack' }) + dimmedBefore
      );
    }
    
    // Error line (with space before code)
    // Highlight the error range if endColumn is specified
    let highlightedErrorLine = truncatedErrorLine;
    if (endColumn && endColumn > startColumn) {
      const highlightStart = mapColumnToDisplay(startColumn); // 1-based
      const highlightEnd = mapColumnToDisplay(endColumn); // 1-based
      
      // Split at highlight start and end positions (splitAtVisiblePos uses 0-based)
      const { before: beforeHighlight } = splitAtVisiblePos(truncatedErrorLine, highlightStart - 1);
      const remainingAfterStart = truncatedErrorLine.substring(beforeHighlight.length);
      const highlightLength = highlightEnd - highlightStart + 1;
      const { before: highlightRange } = splitAtVisiblePos(remainingAfterStart, highlightLength);
      const afterHighlight = remainingAfterStart.substring(highlightRange.length);
      
      // Apply highlight color: brighter on dark terminal, whiter on light terminal
      const highlightColor = isDarkTerminal() ? 'brightWhite' : 'white';
      const highlightedRange = applyStyle(highlightRange, { color: highlightColor });
      
      highlightedErrorLine = beforeHighlight + highlightedRange + afterHighlight;
    }
    
    const errorLineNum = String(startLine);
    const errorLineNumPadded = errorLineNum.padStart(lineNumWidth);
    let errorLineDisplay = applyStyle(`${errorLineNumPadded} `, { color: lineNumberColor, dim: isDarkTerminal() }) +
      applyStyle('│ ', { color: 'brightBlack' }) + highlightedErrorLine;
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
    let indicatorLine = ' '.repeat(lineNumWidth) + ' ' + applyStyle('│', { color: 'brightBlack' }) + ' ' +
      ' '.repeat(spacesBefore);
    
    // Calculate connectCol for short message (if present)
    const connectCol = shortMessage && underlineLength > 1
      ? underlineStartInCode + Math.floor(underlineLength / 2)
      : underlineStartInCode;
    
    const underlineStartCol = underlineStartInCode;
    const underlineEndCol = underlineEndInCode;
    
    if (endColumn && underlineEndCol > underlineStartCol) {
      // Underline with curved edges facing up
      // Use underlineLength which was already calculated correctly (end - start + 1)
      const underlineLen = underlineLength;
      
      if (shortMessage) {
        // With short message: T-bar in the middle
        const connectPosInUnderline = connectCol - underlineStartCol; // Position within the underline
        
        if (underlineLen >= 3) {
          // Build underline with T-bar: left curve, dashes, T-bar, dashes, right curve
          // Total length = 1 (┖) + left dashes + 1 (┬) + right dashes + 1 (┚) = underlineLen
          // So: left dashes + right dashes = underlineLen - 3
          // T-bar is at position connectPosInUnderline (0-indexed from start), so:
          // - left dashes = connectPosInUnderline - 1 (before T-bar, after ┖)
          // - right dashes = underlineLen - 3 - (connectPosInUnderline - 1) = underlineLen - connectPosInUnderline - 2
          const leftPart = '─'.repeat(Math.max(0, connectPosInUnderline - 1));
          const rightPart = '─'.repeat(Math.max(0, underlineLen - connectPosInUnderline - 2));
          indicatorLine += applyStyle('┖' + leftPart + '┬' + rightPart + '┚', { color: colorScheme.primary });
        } else if (underlineLen === 2) {
          // Too short for T-bar, just use T in middle
          indicatorLine += applyStyle('┖┬┚', { color: colorScheme.primary });
        } else {
          // Single character, just use T
          indicatorLine += applyStyle('╿', { color: colorScheme.primary });
        }
      } else {
        // No short message: flat underline with curved ends (no T-bar)
        // For underlineLen=2: ┖┚ (no dashes), for underlineLen=3: ┖─┚ (1 dash), etc.
        const dashes = '─'.repeat(Math.max(0, underlineLen - 2));
        indicatorLine += applyStyle('┖' + dashes + '┚', { color: colorScheme.primary });
      }
    } else {
      // Single point - use ┬ (T pointing up) which has horizontal bar pointing to code, vertical line going down
      indicatorLine += applyStyle('╿', { color: colorScheme.primary });
    }
    
    codeLines.push(indicatorLine);
    
    // Short message connected to underline (if provided)
    if (shortMessage) {
      
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
      // Make non-error lines slightly dimmer: darker on dark terminals, whiter on light terminals
      const dimmedAfter = isDarkTerminal() 
        ? applyStyle(truncatedAfter, { dim: true })
        : applyStyle(truncatedAfter, { color: 'brightBlack' });
      codeLines.push(
        applyStyle(`${afterLineNumPadded} `, { color: lineNumberColor, dim: isDarkTerminal() }) +
        applyStyle('│ ', { color: 'brightBlack' }) + dimmedAfter
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

