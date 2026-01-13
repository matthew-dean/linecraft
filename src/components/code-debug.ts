// Code debug component for displaying code errors/warnings with context

import type { RenderContext, Component } from '../component.js';
import { callComponent } from '../component.js';
import type { Color } from '../types.js';
import { applyStyle } from '../utils/colors.js';
import { stripAnsi, truncateToWidth, truncateFocusRange, mapColumnToDisplay, countVisibleChars, splitAtVisiblePos } from '../utils/text.js';
import { logToFile } from '../utils/debug-log.js';
import { fileLink } from '../utils/file-link.js';
import { Styled } from './styled.js';
import { grid as Grid } from '../layout/grid.js';
import { isDarkTerminal, autoColor, type AutoColor } from '../utils/terminal-theme.js';

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
  /** Placement of short message: 'left' or 'right' (default: 'right', auto: 'left' when target is near end of long line) */
  shortMessagePlacement?: 'left' | 'right' | 'auto';
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
      shortMessagePlacement = 'auto',
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
    const colorScheme = {
      primary: type as AutoColor,
      message: type as AutoColor,
    };
    
    // Get appropriate line number color based on terminal theme (muted color)
    const lineNumColor = 'muted';
    
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
    
    // Use truncateFocusRange to show the target range with proper truncation
    const targetEndCol = endColumn ?? startColumn;
    const defaultCodeColor = autoColor('base');
    const styledErrorLine = applyStyle(errorLine, { color: defaultCodeColor });
    const truncateResult = truncateFocusRange(
      styledErrorLine,
      codeAreaWidth,
      startColumn,
      targetEndCol,
      maxColumn
    );
    const truncatedErrorLine = truncateResult.text;
    const visibleStartCol = truncateResult.visibleStartCol;
    const visibleEndCol = truncateResult.visibleEndCol;
    const rangeStartCol = truncateResult.rangeStartCol;
    const rangeEndCol = truncateResult.rangeEndCol;
    
    // Helper to map original column to display position using the actual visible range
    const mapColumnToDisplayLocal = (originalCol: number): number => {
      const result = mapColumnToDisplay(
        errorLine,
        truncatedErrorLine,
        visibleStartCol,
        visibleEndCol,
        originalCol,
        rangeStartCol,
        rangeEndCol
      );
      
      return result;
    };
    
    // Build the code block lines
    const codeLines: string[] = [];
    
    // Icon and message at the top (Oxlint style)
    // Use grid to handle wrapping automatically
    const icon = type === 'error' ? '✖' : type === 'warning' ? '⚠' : 'ℹ';
    const iconStyled = applyStyle(icon, { color: colorScheme.primary });
    
    // Build the combined message text: errorCode (if present) + message
    // The errorCode should be underlined and bold, followed by ": ", then the message
    // All parts should have the message color
    let messageText: string;
    if (errorCode) {
      const errorCodeStyled = applyStyle(errorCode, { 
        color: colorScheme.primary,
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
    const curve = applyStyle('╭─', { color: 'muted' });
    const bracketOpen = '[';
    const colon1 = ':';
    // Use location color (magenta) for line/column numbers
    const locationNumColor = 'location';
    const lineNum = applyStyle(String(startLine), { color: locationNumColor });
    const colon2 = ':';
    const colNum = applyStyle(String(startColumn), { color: locationNumColor });
    const bracketClose = ']';
    
    // Calculate max width for path: available width minus fixed parts
    // Fixed parts: curveIndent + ╭─ + [ + : + lineNum + : + colNum + ]
    // Note: lineNum and colNum are now styled, so we need to use plain strings for width calculation
    const lineNumPlain = String(startLine);
    const colNumPlain = String(startColumn);
    const fixedParts = curveIndent + '╭─[' + lineNumPlain + ':' + colNumPlain + ']';
    const fixedPartsWidth = countVisibleChars(fixedParts);
    // Ensure pathMaxWidth is finite and reasonable (cap at 40 to prevent extremely long paths)
    const pathMaxWidth = Math.max(10, Math.min(40, availableWidth - fixedPartsWidth));
    
    // Create clickable file link with styling and max width constraint
    const pathWithLink = fileLink(fullPath, pathText);
    const pathStyled = Styled(
      { color: 'accent', overflow: 'ellipsis-start', max: pathMaxWidth },
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
      // Make non-error lines slightly dimmer
      const dimmedBefore = applyStyle(truncatedBefore, { color: 'muted' });
      codeLines.push(
        applyStyle(`${beforeLineNumPadded} `, { color: lineNumColor }) +
        applyStyle('│ ', { color: 'muted' }) + dimmedBefore
      );
    }
    
    // Error line (with space before code)
    // truncatedErrorLine already has the default color applied
    let highlightedErrorLine = truncatedErrorLine;
    
    // Highlight the error range if endColumn is specified
    if (endColumn && endColumn > startColumn) {
      // Map columns to display positions in the truncated (and styled) text
      // We need to map based on the plain truncated text, then account for ANSI codes
      const truncatedPlain = stripAnsi(truncatedErrorLine);
      const highlightStart = mapColumnToDisplayLocal(startColumn); // 1-based display position
      const highlightEnd = mapColumnToDisplayLocal(endColumn); // 1-based display position
      
      // Split at highlight start and end positions (splitAtVisiblePos uses 0-based)
      const { before: beforeHighlight, after: remainingAfterStart } = splitAtVisiblePos(highlightedErrorLine, highlightStart - 1);
      const highlightLength = highlightEnd - highlightStart + 1;
      const { before: highlightRange, after: afterHighlight } = splitAtVisiblePos(remainingAfterStart, highlightLength);
      
      // Strip existing ANSI codes from highlight range and apply new highlight color
      // This ensures the highlight color properly overrides the default code color
      const highlightPlain = stripAnsi(highlightRange);
      const highlightedRangeStyled = applyStyle(highlightPlain, { color: 'highlight' });
      
      highlightedErrorLine = beforeHighlight + highlightedRangeStyled + afterHighlight;
    }
    
    const errorLineNum = String(startLine);
    const errorLineNumPadded = errorLineNum.padStart(lineNumWidth);
    let errorLineDisplay = applyStyle(`${errorLineNumPadded} `, { color: lineNumColor }) +
      applyStyle('│ ', { color: 'muted' }) + highlightedErrorLine;
    codeLines.push(errorLineDisplay);
    
    // Underline line (Oxlint style)
    // Format: "[lineNumWidth spaces][1 space][│][1 space][dots][underline]"
    // Calculate positions relative to the code (after "│ ")
    const underlineStartInCode = mapColumnToDisplayLocal(startColumn);
    const underlineEndInCode = endColumn ? mapColumnToDisplayLocal(endColumn) : underlineStartInCode;
    const underlineLength = underlineEndInCode - underlineStartInCode + 1;
    
    // Spaces to align with the start of the underline
    // underlineStartInCode is position in truncated text (which is what's displayed after │ )
    // The ellipsis is PART of the displayed text, so we use the position directly
    // Position is 1-based, so spacesBefore = underlineStartInCode - 1
    const spacesBefore = Math.max(0, underlineStartInCode - 1);
    
    // Underline line: line number width + space + │ + space + spaces + underline
    let indicatorLine = ' '.repeat(lineNumWidth) + ' ' + applyStyle('│', { color: 'muted' }) + ' ' +
      ' '.repeat(spacesBefore);
    
    // Calculate connectCol for short message (if present)
    // This is the position where the T-bar (┬) will be, which is the middle of the underline
    // Use positions in the truncated text (which is what's displayed)
    const connectCol = shortMessage && underlineLength > 1
      ? underlineStartInCode + Math.floor(underlineLength / 2)
      : underlineStartInCode;
    
    // Calculate the position of the T-bar within the indicator line (after │ and space)
    // Prefix length: lineNumWidth + 3
    // spacesBefore: number of spaces after prefix
    // Underline starts at: lineNumWidth + 3 + spacesBefore + 1
    // T-bar is at: (start of underline) + (connectCol - underlineStartInCode)
    const connectPosInIndicator = (lineNumWidth + 3) + spacesBefore + (connectCol - underlineStartInCode) + 1;
    
    const underlineStartCol = underlineStartInCode;
    const underlineEndCol = underlineEndInCode;
    
    if (endColumn && underlineEndCol > underlineStartCol) {
      // Underline with curved edges facing up
      // Use underlineLength which was already calculated correctly (end - start + 1)
      const underlineLen = underlineLength;
      
      if (shortMessage) {
        // With short message: T-bar in the middle
        const connectPosInUnderline = connectCol - underlineStartInCode; // Position within the underline
        
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
          // Exactly 2 characters: just the brackets, no T-bar
          indicatorLine += applyStyle('┖┚', { color: colorScheme.primary });
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
      // Determine placement: 'auto' means calculate which side has more available space
      let placement: 'left' | 'right' = shortMessagePlacement === 'auto' 
        ? (() => {
            const shortMessageWidth = countVisibleChars(shortMessage);
            const connectorWidth = 4; // " ──╯" or "╰── " is 4 characters
            const totalWidth = shortMessageWidth + connectorWidth;
            
            // Available space on left: from start of code area to connectCol
            const availableLeft = connectCol - 1;
            // Available space on right: from connectCol to end of code area
            const availableRight = codeAreaWidth - connectCol;
            
            // Place on left if left has more space, otherwise right
            return availableLeft >= availableRight ? 'left' : 'right';
          })()
        : shortMessagePlacement;
      
      if (placement === 'left') {
        // Short message on left: message + connector pointing right (curved up)
        // The ╯ should be at connectPosInIndicator
        const messageWidth = countVisibleChars(shortMessage);
        const linePrefixWidth = lineNumWidth + 3; // lineNumWidth + space + │ + space
        const spacesBeforeMessage = Math.max(0, connectPosInIndicator - linePrefixWidth - messageWidth - 4);
        const shortMessageLine = ' '.repeat(lineNumWidth) + ' ' + applyStyle('│', { color: 'muted' }) + ' ' +
          ' '.repeat(spacesBeforeMessage) +
          applyStyle(shortMessage, { color: colorScheme.message }) +
          applyStyle(' ──╯', { color: colorScheme.primary });
        codeLines.push(shortMessageLine);
      } else {
        // Short message on right: connector pointing left (curved up) + message
        // The ╰ should be at connectPosInIndicator
        const linePrefixWidth = lineNumWidth + 3; // lineNumWidth + space + │ + space
        const spacesBeforeConnector = Math.max(0, connectPosInIndicator - linePrefixWidth - 1);
        const shortMessageLine = ' '.repeat(lineNumWidth) + ' ' + applyStyle('│', { color: 'muted' }) + ' ' +
          ' '.repeat(spacesBeforeConnector) +
          applyStyle('╰── ', { color: colorScheme.primary }) +
          applyStyle(shortMessage, { color: colorScheme.message });
        codeLines.push(shortMessageLine);
      }
    }
    
    // Line after (if exists)
    if (lineAfter !== null && lineAfter !== undefined) {
      const afterLineNum = String(startLine + 1);
      const afterLineNumPadded = afterLineNum.padStart(lineNumWidth);
      const truncatedAfter = truncateToWidth(lineAfter, codeAreaWidth);
      // Make non-error lines slightly dimmer
      const dimmedAfter = applyStyle(truncatedAfter, { color: 'muted' });
      codeLines.push(
        applyStyle(`${afterLineNumPadded} `, { color: lineNumColor }) +
        applyStyle('│ ', { color: 'muted' }) + dimmedAfter
      );
    }
    
    // Bottom curve to close the box (Oxlint style)
    const bottomCurveIndent = ' '.repeat(lineNumWidth + 1);
    const bottomCurve = bottomCurveIndent + applyStyle('╰─', { color: 'muted' });
    codeLines.push(bottomCurve);
    
    // Return lines directly (no Section wrapper for Oxlint style)
    return codeLines;
  };
}

