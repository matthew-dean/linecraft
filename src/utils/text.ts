// Text utilities for handling overflow, ellipsis, etc.

import { logToFile } from './debug-log.js';

/**
 * Strip ANSI escape codes from a string to get plain text
 * 
 * This removes all ANSI escape sequences (e.g., color codes, cursor movements)
 * from the input string, returning only the visible characters.
 * 
 * @param text - String that may contain ANSI escape codes
 * @returns Plain text with all ANSI codes removed
 * 
 * @example
 * stripAnsi('\x1b[31mHello\x1b[0m') // 'Hello'
 */
export function stripAnsi(text: string): string {
  // Remove all ANSI escape sequences (SGR and OSC) by iterating and skipping them
  let result = '';
  let idx = 0;
  while (idx < text.length) {
    if (text[idx] === '\x1b') {
      // Skip the escape sequence
      const nextIdx = skipEscapeSequence(text, idx);
      idx = nextIdx;
    } else {
      // Regular character, keep it
      result += text[idx];
      idx++;
    }
  }
  return result;
}

/**
 * Skip escape sequences (ANSI SGR, OSC 8, and other OSC sequences)
 * 
 * @param text - Text that may contain escape sequences
 * @param idx - Current index in the text
 * @returns Next index after the escape sequence, or idx+1 if not an escape sequence
 */
function skipEscapeSequence(text: string, idx: number): number {
  if (idx >= text.length || text[idx] !== '\x1b') {
    return idx; // Not an escape sequence, return same index so caller can count the character
  }
  
  if (idx + 1 < text.length && text[idx + 1] === '[') {
    // ANSI SGR sequence: \x1b[<numbers>m
    let end = idx + 2;
    while (end < text.length && text[end] !== 'm') {
      end++;
    }
    if (end < text.length) {
      end++;
    }
    return end;
  } else if (idx + 1 < text.length && text[idx + 1] === ']') {
    // OSC sequence: \x1b]8;;<url>\x1b\\ or \x1b]8;;\x1b\\
    if (idx + 4 < text.length && text.substring(idx, idx + 4) === '\x1b]8;') {
      // OSC 8 hyperlink sequence
      let end = idx + 4;
      while (end < text.length - 1) {
        if (text[end] === '\x1b' && text[end + 1] === '\\') {
          end += 2;
          break;
        }
        end++;
      }
      return end;
    } else {
      // Other OSC sequence
      let end = idx + 2;
      while (end < text.length && text[end] !== '\x07' && text[end] !== '\x1b') {
        end++;
      }
      if (end < text.length && text[end] === '\x07') {
        end++;
      } else if (end < text.length && text[end] === '\x1b' && end + 1 < text.length && text[end + 1] === '\\') {
        end += 2;
      }
      return end;
    }
  } else {
    // Unknown escape sequence, skip the escape character
    return idx + 1;
  }
}

/**
 * Truncate text to a maximum visual width while preserving ANSI escape codes
 * 
 * This function truncates text based on its visual width (ignoring ANSI codes),
 * but preserves all ANSI escape sequences in the output. Active ANSI codes are
 * preserved in the truncated result.
 * 
 * @param text - Text that may contain ANSI escape codes
 * @param maxWidth - Maximum visual width (number of visible characters)
 * @returns Truncated text with ANSI codes preserved (no ellipsis added)
 * 
 * @example
 * truncateToWidth('\x1b[31mHello World\x1b[0m', 8) // '\x1b[31mHello Wo\x1b[0m'
 */
export function truncateToWidth(text: string, maxWidth: number): string {
  if (maxWidth <= 0) {
    return '';
  }
  
  // Quick check: if plain text fits, no truncation needed
  const plain = stripAnsi(text);
  if (plain.length <= maxWidth) {
    return text;
  }
  
  // Truncate while preserving ANSI codes and OSC 8 sequences
  // We iterate through the string, counting visual characters while skipping escape sequences
  let visual = 0;  // Count of visible characters seen so far
  let idx = 0;     // Current position in the string
  
  while (idx < text.length && visual < maxWidth) {
    const nextIdx = skipEscapeSequence(text, idx);
    if (nextIdx > idx) {
      // We skipped an escape sequence
      idx = nextIdx;
    } else {
      // Regular character - count it and advance
      idx++;
      visual++;
    }
  }
  
  // Return substring up to the truncation point (preserves all ANSI codes up to that point)
  const truncated = text.substring(0, idx);
  // Close any open OSC 8 hyperlink
  return truncated + closeOsc8IfOpen(truncated);
}

/**
 * Truncate text with ellipsis at the end, preserving ANSI escape codes
 * 
 * Active ANSI codes from the truncated portion are preserved, and the ellipsis
 * is added after the truncated text (without ANSI codes).
 * 
 * @param text - Text that may contain ANSI escape codes
 * @param maxWidth - Maximum visual width (number of visible characters)
 * @returns Truncated text with '...' at the end, ANSI codes preserved
 * 
 * @example
 * truncateEnd('\x1b[31mHello World\x1b[0m', 8) // '\x1b[31mHello...\x1b[0m'
 */
export function truncateEnd(text: string, maxWidth: number): string {
  const plain = stripAnsi(text);
  if (plain.length <= maxWidth) {
    return text;
  }
  if (maxWidth <= 3) {
    return '.'.repeat(maxWidth);
  }
  
  // 1. Extract raw portion before truncation
  let visual = 0;
  let idx = 0;
  while (idx < text.length && visual < maxWidth - 3) {
    const nextIdx = skipEscapeSequence(text, idx);
    if (nextIdx > idx) idx = nextIdx;
    else { idx++; visual++; }
  }
  const rawTruncated = text.substring(0, idx);
  const activeCodes = extractActiveAnsiCodes(rawTruncated);
  
  // 2. Add ellipsis with the same active codes, then close everything
  const ellipsis = activeCodes ? activeCodes + '...' : '...';
  return rawTruncated + ellipsis + closeOsc8IfOpen(activeCodes) + '\x1b[0m';
}

/**
 * Truncate text with ellipsis at the beginning, preserving ANSI escape codes
 * 
 * When truncating from the start, we preserve ANSI codes that are active in the
 * remaining portion. The ellipsis is added at the beginning (without ANSI codes),
 * and active codes from the original text are re-applied to the remaining portion.
 * 
 * @param text - Text that may contain ANSI escape codes
 * @param maxWidth - Maximum visual width (number of visible characters)
 * @returns Truncated text with '...' at the beginning, ANSI codes preserved
 * 
 * @example
 * truncateStart('\x1b[31mHello World\x1b[0m', 8) // '...\x1b[31mWorld\x1b[0m'
 */
export function truncateStart(text: string, maxWidth: number): string {
  const visibleWidth = countVisibleChars(text);
  if (visibleWidth <= maxWidth) {
    return text;
  }
  if (maxWidth <= 3) {
    return '.'.repeat(maxWidth);
  }
  
  const availableWidth = maxWidth - 3;
  const startVisibleIdx = visibleWidth - availableWidth;
  
  let visual = 0;
  let idx = 0;
  while (idx < text.length && visual < startVisibleIdx) {
    const nextIdx = skipEscapeSequence(text, idx);
    if (nextIdx > idx) idx = nextIdx;
    else { idx++; visual++; }
  }
  
  const remaining = text.substring(idx);
  const beforeCut = text.substring(0, idx);
  const activeCodes = extractActiveAnsiCodes(beforeCut);
  
  // To ensure the hyperlink is preserved:
  // 1. ellipsis starts with activeCodes
  // 2. remaining is appended
  // (remaining already has its own closing codes if it was originally linked)
  const ellipsis = activeCodes ? activeCodes + '...' : '...';
  return ellipsis + remaining;
}

/**
 * Truncate text with ellipsis in the middle, preserving ANSI escape codes
 * 
 * When truncating in the middle, we preserve ANSI codes from the start portion
 * and re-apply them to the end portion to maintain consistent styling.
 * 
 * @param text - Text that may contain ANSI escape codes
 * @param maxWidth - Maximum visual width (number of visible characters)
 * @returns Truncated text with '...' in the middle, ANSI codes preserved
 * 
 * @example
 * truncateMiddle('\x1b[31mHello World\x1b[0m', 8) // '\x1b[31mHel...ld\x1b[0m'
 */
export function truncateMiddle(text: string, maxWidth: number): string {
  const plain = stripAnsi(text);
  if (plain.length <= maxWidth) {
    return text;
  }
  if (maxWidth <= 3) {
    return '.'.repeat(maxWidth);
  }
  
  const availableChars = maxWidth - 3;
  const startChars = Math.floor(availableChars / 2);
  const endChars = availableChars - startChars;
  
  // Get start portion
  let visual = 0;
  let idx = 0;
  while (idx < text.length && visual < startChars) {
    const nextIdx = skipEscapeSequence(text, idx);
    if (nextIdx > idx) idx = nextIdx;
    else { idx++; visual++; }
  }
  const startPortion = text.substring(0, idx);
  const activeCodes = extractActiveAnsiCodes(startPortion);
  
  // Get end portion
  const endStartIdx = plain.length - endChars;
  visual = 0;
  idx = 0;
  while (idx < text.length && visual < endStartIdx) {
    const nextIdx = skipEscapeSequence(text, idx);
    if (nextIdx > idx) idx = nextIdx;
    else { idx++; visual++; }
  }
  const endPortion = text.substring(idx);
  
  // ellipsis and endPortion both need activeCodes
  const ellipsis = activeCodes ? activeCodes + '...' : '...';
  return startPortion + ellipsis + endPortion;
}

/**
 * Extract a visible character range from text, preserving ANSI codes
 * 
 * @param text - Text that may contain ANSI escape codes
 * @param startCol - Start column (1-based)
 * @param endCol - End column (1-based)
 * @returns Object with { before: string, range: string, after: string }
 */
function extractVisibleRange(
  text: string,
  startCol: number,
  endCol: number
): { before: string; range: string; after: string } {
  const { before, after: remainingAfterStart } = splitAtVisiblePos(text, startCol - 1);
  const rangeLength = endCol - startCol + 1;
  const { before: range, after } = splitAtVisiblePos(remainingAfterStart, rangeLength);
  return { before, range, after };
}

/**
 * Map an original column position to its display position in truncated text
 * 
 * This function takes the original text, the truncated result, and the visible range
 * that was shown, and maps an original column to where it appears in the truncated text.
 * 
 * @param originalText - The original text (plain, no ANSI)
 * @param truncatedText - The truncated text result (may have ellipsis)
 * @param visibleStartCol - The first column that was shown (1-based, includes truncated before)
 * @param visibleEndCol - The last column that was shown (1-based, includes truncated after)
 * @param originalCol - The original column to map (1-based)
 * @param rangeStartCol - The start column of the main range (1-based, optional, for better accuracy)
 * @param rangeEndCol - The end column of the main range (1-based, optional, for better accuracy)
 * @returns The display position in the truncated text (1-based, visible characters)
 */
export function mapColumnToDisplay(
  originalText: string,
  truncatedText: string,
  visibleStartCol: number,
  visibleEndCol: number,
  originalCol: number,
  rangeStartCol?: number,
  rangeEndCol?: number
): number {
  const truncatedPlain = stripAnsi(truncatedText);
  const hasEllipsisStart = truncatedPlain.startsWith('...');
  const hasEllipsisEnd = truncatedPlain.endsWith('...');
  const ellipsisStartOffset = hasEllipsisStart ? 3 : 0;
  
  // If we have range boundaries, use them for more accurate mapping
  if (rangeStartCol !== undefined && rangeEndCol !== undefined) {
    // Calculate how much of 'before' is shown (if truncated)
    let shownBeforeChars = 0;
    if (hasEllipsisStart && rangeStartCol > visibleStartCol) {
      // The visible before portion is from visibleStartCol to (rangeStartCol - 1)
      shownBeforeChars = (rangeStartCol - 1) - visibleStartCol + 1;
    } else if (!hasEllipsisStart && rangeStartCol > 1) {
      // All of before is shown
      shownBeforeChars = rangeStartCol - 1;
    }
    
    // If column is before the range, it's in the truncated before portion
    if (originalCol < rangeStartCol) {
      if (originalCol < visibleStartCol) {
        return ellipsisStartOffset || 1;
      }
      // Column is in the visible before portion
      const offsetInBefore = originalCol - visibleStartCol + 1;
      return ellipsisStartOffset + offsetInBefore;
    }
    
    // If column is in the range, calculate position relative to range start
    if (originalCol >= rangeStartCol && originalCol <= rangeEndCol) {
      const offsetInRange = originalCol - rangeStartCol + 1;
      // We need to count how many visible characters are in 'truncatedBefore'
      const truncatedBeforeWidth = hasEllipsisStart ? (shownBeforeChars + 3) : shownBeforeChars;
      return truncatedBeforeWidth + offsetInRange;
    }
    
    // If column is after the range, it's in the truncated after portion
    if (originalCol > rangeEndCol) {
      if (originalCol > visibleEndCol) {
        return countVisibleChars(truncatedPlain);
      }
      // Column is in the visible after portion
      const rangeWidth = rangeEndCol - rangeStartCol + 1;
      const offsetInAfter = originalCol - rangeEndCol;
      const truncatedBeforeWidth = hasEllipsisStart ? (shownBeforeChars + 3) : shownBeforeChars;
      return truncatedBeforeWidth + rangeWidth + offsetInAfter;
    }
  }
  
  // Fallback to simple calculation if range boundaries not provided
  // If column is before visible range, point to start ellipsis or first character
  if (originalCol < visibleStartCol) {
    return ellipsisStartOffset || 1;
  }
  
  // If column is after visible range, point to end
  if (originalCol > visibleEndCol) {
    return countVisibleChars(truncatedPlain);
  }
  
  // Column is in visible range - calculate its position
  // Position = ellipsis offset + (originalCol - visibleStartCol + 1)
  return ellipsisStartOffset + (originalCol - visibleStartCol + 1);
}

/**
 * Result of truncateFocusRange, including information about what range was shown
 */
export interface TruncateFocusRangeResult {
  /** The truncated text with target range visible */
  text: string;
  /** The first column that was shown (1-based, includes truncated before portion) */
  visibleStartCol: number;
  /** The last column that was shown (1-based, includes truncated after portion) */
  visibleEndCol: number;
  /** The start column of the main range (1-based, the focused portion) */
  rangeStartCol: number;
  /** The end column of the main range (1-based, the focused portion) */
  rangeEndCol: number;
}

/**
 * Truncate text to show a specific column range, with ellipsis as needed
 * 
 * This function ensures a target range (startCol to endCol) is visible in the output,
 * adding ellipsis at the start, end, or both as needed to fit within maxWidth.
 * All ANSI codes and OSC 8 hyperlinks are preserved.
 * 
 * @param text - Text that may contain ANSI escape codes
 * @param maxWidth - Maximum visual width (number of visible characters)
 * @param targetStartCol - Start column of target range (1-based)
 * @param targetEndCol - End column of target range (1-based, optional)
 * @param maxColumn - Maximum column to show (optional, for limiting display)
 * @returns Truncated text with target range visible, ANSI codes preserved, and visible range info
 * 
 * @example
 * truncateFocusRange('console.log("hello world");', 20, 1, 11)
 * // Returns text showing columns 1-11 with ellipsis if needed
 */
export function truncateFocusRange(
  text: string,
  maxWidth: number,
  targetStartCol: number,
  targetEndCol?: number,
  maxColumn?: number
): TruncateFocusRangeResult {
  const codeLength = countVisibleChars(text);
  const targetEnd = targetEndCol ?? targetStartCol;
  
  // If code fits, show everything
  if (codeLength <= maxWidth) {
    return {
      text: truncateToWidth(text, maxWidth),
      visibleStartCol: 1,
      visibleEndCol: codeLength,
      rangeStartCol: targetStartCol,
      rangeEndCol: targetEnd,
    };
  }
  
  const effectiveMaxCol = maxColumn ? Math.min(maxColumn, codeLength) : codeLength;
  const targetWidth = targetEnd - targetStartCol + 1;
  
  // If target doesn't fit, just show middle with ellipsis
  if (targetWidth > maxWidth - 6) {
    const midPoint = Math.floor((maxWidth - 6) / 2);
    const startCol = Math.max(1, targetStartCol - midPoint);
    const endCol = Math.min(effectiveMaxCol, startCol + maxWidth - 6);
    const { range } = extractVisibleRange(text, startCol, endCol);
    return {
      text: '...' + truncateToWidth(range, maxWidth - 3) + '...',
      visibleStartCol: startCol,
      visibleEndCol: endCol,
      rangeStartCol: startCol,
      rangeEndCol: endCol,
    };
  }
  
  // Calculate visible range to center target
  const willNeedEllipsisStart = targetStartCol > 1 || (targetStartCol === 1 && codeLength > maxWidth);
  const willNeedEllipsisEnd = targetEnd < codeLength || codeLength > maxWidth;
  const ellipsisWidth = (willNeedEllipsisStart ? 3 : 0) + (willNeedEllipsisEnd ? 3 : 0);
  const effectiveAvailableWidth = maxWidth - ellipsisWidth;
  
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
  
  // Extract the visible range using the helper
  const { before, range, after } = extractVisibleRange(text, startCol, endCol);
  
  // Use existing truncation utilities to add ellipsis
  const hasEllipsisStart = startCol > 1;
  const hasEllipsisEnd = endCol < codeLength;
  const rangeWidth = countVisibleChars(range);
  
  let truncatedText: string;
  let actualVisibleStartCol = startCol;
  let actualVisibleEndCol = endCol;
  
  if (hasEllipsisStart && hasEllipsisEnd) {
    const beforeWidth = maxWidth - rangeWidth - 3; // -3 for end ellipsis
    const truncatedBefore = before ? truncateStart(before, Math.max(3, beforeWidth)) : '';
    const afterWidth = maxWidth - countVisibleChars(truncatedBefore) - rangeWidth - 3; // -3 for start ellipsis
    const truncatedAfter = after ? truncateEnd(after, Math.max(3, afterWidth)) : '';
    truncatedText = truncatedBefore + range + truncatedAfter;
    
    // Adjust visible range: if before was truncated, calculate actual start
    // 'before' contains columns 1 to (startCol - 1)
    // truncateStart shows the END of 'before', so if we show the last N chars of 'before',
    // the first visible column from 'before' is: (startCol - 1) - N + 1 = startCol - N
    if (truncatedBefore && before) {
      const truncatedBeforePlain = stripAnsi(truncatedBefore);
      if (truncatedBeforePlain.startsWith('...')) {
        const shownBeforeChars = countVisibleChars(truncatedBeforePlain) - 3; // minus ellipsis
        // 'before' contains columns 1 to (startCol - 1), so it has (startCol - 1) characters
        // If we show the last N chars of 'before', the first visible column is: startCol - N
        actualVisibleStartCol = Math.max(1, startCol - shownBeforeChars);
      } else {
        // No ellipsis means we showed all of before, so visible start is 1
        actualVisibleStartCol = 1;
      }
    } else if (before && before.length > 0) {
      // Before exists but wasn't truncated, so all of before is visible
      actualVisibleStartCol = 1;
    }
    
    // Adjust visible range: if after was truncated, calculate actual end
    // truncateEnd shows the START of 'after', so if we show N chars from the start of 'after',
    // the actual visible end is: endCol + N
    if (truncatedAfter && after) {
      const truncatedAfterPlain = stripAnsi(truncatedAfter);
      if (truncatedAfterPlain.endsWith('...')) {
        const shownAfterChars = countVisibleChars(truncatedAfterPlain) - 3; // minus ellipsis
        // 'after' starts at endCol + 1, so if we show the first N chars, visible end is endCol + N
        actualVisibleEndCol = endCol + shownAfterChars;
      } else {
        // No ellipsis means we showed all of after
        actualVisibleEndCol = codeLength;
      }
    } else if (after && after.length > 0) {
      // After exists but wasn't truncated, so all of after is visible
      actualVisibleEndCol = codeLength;
    }
  } else if (hasEllipsisStart) {
    const beforeWidth = maxWidth - rangeWidth;
    const truncatedBefore = before ? truncateStart(before, beforeWidth) : '';
    truncatedText = truncatedBefore + range + after;
    
    // Adjust visible range: if before was truncated, calculate actual start
    const truncatedBeforePlain = stripAnsi(truncatedBefore);
    if (truncatedBefore && before && truncatedBeforePlain.startsWith('...')) {
      const shownBeforeChars = countVisibleChars(truncatedBeforePlain) - 3;
      actualVisibleStartCol = Math.max(1, startCol - shownBeforeChars);
    } else if (truncatedBefore && before) {
      // No ellipsis means we showed all of before
      actualVisibleStartCol = 1;
    }
    
    // After is fully shown
    actualVisibleEndCol = codeLength;
  } else if (hasEllipsisEnd) {
    const afterWidth = maxWidth - rangeWidth;
    const truncatedAfter = after ? truncateEnd(after, afterWidth) : '';
    truncatedText = before + range + truncatedAfter;
    
    // Before is fully shown
    actualVisibleStartCol = 1;
    
    // Adjust visible range: if after was truncated, calculate actual end
    const truncatedAfterPlain = stripAnsi(truncatedAfter);
    if (truncatedAfter && after && truncatedAfterPlain.endsWith('...')) {
      const shownAfterChars = countVisibleChars(truncatedAfterPlain) - 3;
      actualVisibleEndCol = endCol + shownAfterChars;
    } else {
      // No ellipsis means we showed all of after
      actualVisibleEndCol = codeLength;
    }
  } else {
    // No ellipsis needed
    truncatedText = truncateToWidth(text, maxWidth);
    actualVisibleStartCol = 1;
    actualVisibleEndCol = codeLength;
  }
  
  return {
    text: truncatedText,
    visibleStartCol: actualVisibleStartCol,
    visibleEndCol: actualVisibleEndCol,
    rangeStartCol: startCol,
    rangeEndCol: endCol,
  };
}

/**
 * Wrap text to fit within a width, breaking on spaces
 * Never breaks words mid-word - if a word is too long, it will extend the line
 * ANSI-aware: calculates width based on visible characters, not raw string length
 */
export function wrapText(text: string, width: number): string[] {
  if (!Number.isFinite(width) || width <= 0) {
    return text.length > 0 ? [text] : [''];
  }

  const lines: string[] = [];
  const length = text.length;
  let index = 0;
  let activeCodes = ''; // Track active ANSI codes across line breaks

  while (index < length) {
    // Skip leading spaces
    while (index < length && text[index] === ' ') {
      index++;
    }
    if (index >= length) {
      break;
    }

    // Find the end position based on VISIBLE width (accounting for ANSI codes)
    // We need to find where we've seen 'width' visible characters
    // OR where we hit a newline (which should break the line)
    let visibleCount = 0;
    let end = index;
    let foundNewline = false;
    
    while (end < length && visibleCount < width) {
      if (text[end] === '\x1b') {
        // Found ANSI escape sequence - skip to the end
        let ansiEnd = end + 1;
        while (ansiEnd < length && text[ansiEnd] !== 'm') {
          ansiEnd++;
        }
        if (ansiEnd < length) {
          ansiEnd++; // Include the 'm'
        }
        end = ansiEnd;
      } else if (text[end] === '\n') {
        // Found newline - break here (don't include the newline in the line)
        foundNewline = true;
        break;
      } else {
        // Regular character - count it
        end++;
        visibleCount++;
      }
    }

    // If we found a newline, break the line there
    if (foundNewline) {
      let line = text.slice(index, end); // Don't include the newline
      // Prepend active codes from previous line if we have any
      if (activeCodes) {
        line = activeCodes + line;
      }
      // Extract active codes from this line for the next line
      activeCodes = extractActiveAnsiCodes(line);
      lines.push(line);
      index = end + 1; // Skip past the newline
      continue;
    }

    if (end >= length) {
      // Reached end of text - take the rest
      let finalLine = text.slice(index);
      // Prepend active codes from previous line if we have any
      if (activeCodes) {
        finalLine = activeCodes + finalLine;
      }
      lines.push(finalLine);
      break;
    }

    // Look for a break point (space or hyphen) going backwards from end
    // But we need to search in the visible character space, not raw string position
    let breakPoint = -1;
    let searchVisible = visibleCount;
    let searchIdx = end;
    
    // Search backwards for a space or hyphen
    while (searchIdx > index && searchVisible > 0) {
      // Move backwards, accounting for ANSI codes
      if (text[searchIdx - 1] === '\x1b') {
        // Found ANSI code - skip backwards past it
        let ansiStart = searchIdx - 1;
        while (ansiStart > index && text[ansiStart - 1] !== 'm') {
          ansiStart--;
        }
        if (ansiStart > index && text[ansiStart - 1] === 'm') {
          ansiStart--; // Include the 'm'
        }
        searchIdx = ansiStart;
      } else {
        const char = text[searchIdx - 1];
        if (char === ' ') {
          breakPoint = searchIdx - 1;
          break;
        }
        if (char === '-') {
          breakPoint = searchIdx;
          break;
        }
        searchIdx--;
        searchVisible--;
      }
    }

    if (breakPoint === -1) {
      // No space found within the width - we're in the middle of a word
      // Look for the NEXT space after 'end' to break there
      // This ensures we never break mid-word
      let nextSpace = -1;
      let searchIdx = end;
      while (searchIdx < length) {
        if (text[searchIdx] === '\x1b') {
          // Skip ANSI code
          let ansiEnd = searchIdx + 1;
          while (ansiEnd < length && text[ansiEnd] !== 'm') {
            ansiEnd++;
          }
          if (ansiEnd < length) {
            ansiEnd++;
          }
          searchIdx = ansiEnd;
        } else {
          if (text[searchIdx] === ' ') {
            nextSpace = searchIdx;
            break;
          }
          searchIdx++;
        }
      }
      
      if (nextSpace === -1) {
        // No more spaces - take the rest (this is the last word/line)
        let finalLine = text.slice(index);
        // Prepend active codes from previous line if we have any
        if (activeCodes) {
          finalLine = activeCodes + finalLine;
        }
        lines.push(finalLine);
        break;
      } else {
        // Found a space after - break there (word extends beyond width)
        // This means the word is longer than width, so we have to break after it
        breakPoint = nextSpace;
      }
    }

    let line = text.slice(index, breakPoint).trimEnd();
    
    // Prepend active codes from previous line if we have any
    if (activeCodes) {
      line = activeCodes + line;
    }
    
    // Extract active codes from this line for the next line
    activeCodes = extractActiveAnsiCodes(line);
    lines.push(line);

    index = breakPoint;
    while (index < length && text[index] === ' ') {
      index++;
    }
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * Get the visual width of text (accounting for ANSI codes)
 */
export function getTextWidth(text: string): number {
  return stripAnsi(text).length;
}

export function getTrimmedTextWidth(text: string): number {
  const plain = stripAnsi(text);
  const trimmed = plain.replace(/\s+$/u, '');
  return trimmed.length;
}


/**
 * Count visible characters in text, skipping ANSI escape codes
 * More efficient than stripAnsi().length as it doesn't create a new string
 * 
 * @param text - Text that may contain ANSI escape codes
 * @returns Number of visible characters
 */
export function countVisibleChars(text: string): number {
  let count = 0;
  let idx = 0;
  
  while (idx < text.length) {
    const nextIdx = skipEscapeSequence(text, idx);
    if (nextIdx > idx) {
      // We skipped an escape sequence
      idx = nextIdx;
    } else {
      // Regular character - count it
      idx++;
      count++;
    }
  }
  
  return count;
}

/**
 * Extract active ANSI codes and OSC 8 hyperlinks from text (all codes that are active at the end)
 * Returns the ANSI escape sequences that should be applied to continue the styling
 */
/**
 * Extract only SGR (color/style) codes, excluding OSC 8 hyperlinks
 * Used for ellipsis styling where we want color but not hyperlinks
 */
function extractActiveSgrCodes(text: string): string {
  const codes: string[] = [];
  let idx = 0;
  
  while (idx < text.length) {
    if (text[idx] === '\x1b' && idx + 1 < text.length && text[idx + 1] === '[') {
      // Found ANSI SGR escape sequence
      let end = idx + 2;
      while (end < text.length && text[end] !== 'm') {
        end++;
      }
      if (end < text.length) {
        const code = text.substring(idx, end + 1);
        // Check if it's a reset (0m) or a style code
        if (code === '\x1b[0m') {
          // Reset - clear all previous codes
          codes.length = 0;
        } else {
          // Style code - add it
          codes.push(code);
        }
        idx = end + 1;
      } else {
        idx++;
      }
    } else if (text[idx] === '\x1b' && idx + 4 < text.length && text.substring(idx, idx + 4) === '\x1b]8;') {
      // Skip OSC 8 hyperlink sequences (don't include in result)
      let end = idx + 4;
      while (end < text.length - 1) {
        if (text[end] === '\x1b' && text[end + 1] === '\\') {
          idx = end + 2;
          break;
        }
        end++;
      }
      if (end >= text.length - 1) {
        idx++;
      }
    } else {
      idx++;
    }
  }
  
  return codes.join('');
}

function extractActiveAnsiCodes(text: string): string {
  const codes: string[] = [];
  let idx = 0;
  let osc8Start: string | null = null; // Track OSC 8 hyperlink start sequence
  
  while (idx < text.length) {
    if (text[idx] === '\x1b' && idx + 1 < text.length && text[idx + 1] === '[') {
      // Found ANSI SGR escape sequence
      let end = idx + 2;
      while (end < text.length && text[end] !== 'm') {
        end++;
      }
      if (end < text.length) {
        const code = text.substring(idx, end + 1);
        // Check if it's a reset (0m) or a style code
        if (code === '\x1b[0m') {
          // Reset - clear all previous codes (but keep OSC 8)
          codes.length = 0;
        } else {
          // Style code - add it
          codes.push(code);
        }
        idx = end + 1;
      } else {
        idx++;
      }
    } else if (text[idx] === '\x1b' && idx + 4 < text.length && text.substring(idx, idx + 4) === '\x1b]8;') {
      // Found OSC 8 hyperlink sequence
      let end = idx + 4;
      // Check if this is a start sequence (has URL) or end sequence
      let foundClose = false;
      while (end < text.length - 1) {
        if (text[end] === '\x1b' && text[end + 1] === '\\') {
          // Found closing sequence
          const sequence = text.substring(idx, end + 2);
          if (end === idx + 4) {
            // This is an end sequence (\x1b]8;;\x1b\\)
            osc8Start = null; // Close the hyperlink
          } else {
            // This is a start sequence (\x1b]8;;<url>\x1b\\)
            osc8Start = sequence; // Store the start sequence
          }
          idx = end + 2;
          foundClose = true;
          break;
        }
        end++;
      }
      if (!foundClose) {
        idx++;
      }
    } else {
      idx++;
    }
  }
  
  // Combine ANSI codes and OSC 8 start (if hyperlink is still open)
  const result = codes.join('');
  return osc8Start ? result + osc8Start : result;
}

/**
 * Close any open OSC 8 hyperlink at the end of text
 * Returns the closing sequence if a hyperlink is open, empty string otherwise
 */
function closeOsc8IfOpen(text: string): string {
  let idx = 0;
  let osc8Start: string | null = null;
  
  while (idx < text.length) {
    if (text[idx] === '\x1b' && idx + 4 < text.length && text.substring(idx, idx + 4) === '\x1b]8;') {
      // Found OSC 8 hyperlink sequence
      let end = idx + 4;
      while (end < text.length - 1) {
        if (text[end] === '\x1b' && text[end + 1] === '\\') {
          const sequence = text.substring(idx, end + 2);
          if (end === idx + 4) {
            // End sequence - close hyperlink
            osc8Start = null;
          } else {
            // Start sequence - open hyperlink
            osc8Start = sequence;
          }
          idx = end + 2;
          break;
        }
        end++;
      }
      if (idx === end + 2) {
        continue;
      }
    }
    idx++;
  }
  
  // If hyperlink is still open, return closing sequence
  return osc8Start ? '\x1b]8;;\x1b\\' : '';
}

/**
 * Split text at a specific visible character position, preserving ANSI codes
 * 
 * When splitting, we preserve any active ANSI color codes:
 * - The "before" part gets the codes closed with \x1b[0m if needed
 * - The "after" part gets the active codes re-applied at the start
 * 
 * @param text - Text that may contain ANSI escape codes
 * @param visiblePos - Position in visible characters (0-based)
 * @returns Object with { before: string, after: string } split at the visible position
 * 
 * @example
 * splitAtVisiblePos('\x1b[31mHello World', 5)
 * // { before: '\x1b[31mHello\x1b[0m', after: '\x1b[31m World' }
 */
export function splitAtVisiblePos(text: string, visiblePos: number): { before: string; after: string } {
  if (visiblePos <= 0) {
    return { before: '', after: text };
  }
  
  // First, find the split point
  let visual = 0;  // Count of visible characters seen so far
  let idx = 0;     // Current position in the string
  
  while (idx < text.length && visual < visiblePos) {
    const nextIdx = skipEscapeSequence(text, idx);
    if (nextIdx > idx) {
      // We skipped an escape sequence
      idx = nextIdx;
    } else {
      // Regular character - count it and advance
      idx++;
      visual++;
    }
  }
  
  const before = text.substring(0, idx);
  const after = text.substring(idx);
  
  // Extract active ANSI codes and OSC 8 hyperlinks from the "before" part
  const activeCodes = extractActiveAnsiCodes(before);
  
  // Close any open OSC 8 hyperlink in the "before" part
  const beforeWithClosedOsc8 = before + closeOsc8IfOpen(before);
  
  // If there are active codes, we need to:
  // 1. Close them in the "before" part (unless it already ends with a reset)
  // 2. Re-apply them at the start of the "after" part
  if (activeCodes && !beforeWithClosedOsc8.endsWith('\x1b[0m')) {
    return {
      before: beforeWithClosedOsc8 + '\x1b[0m',
      after: activeCodes + after
    };
  }
  
  return { before: beforeWithClosedOsc8, after };
}
