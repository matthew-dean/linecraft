// Text utilities for handling overflow, ellipsis, etc.

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
  const ansiRegex = /\x1b\[[0-9;]*m/g;
  return text.replace(ansiRegex, '');
}

/**
 * Truncate text to a maximum visual width while preserving ANSI escape codes
 * 
 * This function truncates text based on its visual width (ignoring ANSI codes),
 * but preserves all ANSI escape sequences in the output. This is the base function
 * used by all other truncate functions.
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
  
  // Truncate while preserving ANSI codes
  // We iterate through the string, counting visual characters while skipping ANSI sequences
  let visual = 0;  // Count of visible characters seen so far
  let idx = 0;     // Current position in the string
  
  while (idx < text.length && visual < maxWidth) {
    if (text[idx] === '\x1b') {
      // Found start of ANSI escape sequence - skip to the end
      // ANSI codes follow pattern: \x1b[...m where ... can contain numbers, semicolons
      let end = idx + 1;
      while (end < text.length && text[end] !== 'm') {
        end++;
      }
      // Include the 'm' if found
      if (end < text.length) {
        end++;
      }
      idx = end;
    } else {
      // Regular character - count it and advance
      idx++;
      visual++;
    }
  }
  
  // Return substring up to the truncation point
  return text.substring(0, idx);
}

/**
 * Truncate text with ellipsis at the end, preserving ANSI escape codes
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
  // Truncate to make room for ellipsis, then add ellipsis
  const truncated = truncateToWidth(text, maxWidth - 3);
  return truncated + '...';
}

/**
 * Truncate text with ellipsis at the beginning, preserving ANSI escape codes
 * 
 * @param text - Text that may contain ANSI escape codes
 * @param maxWidth - Maximum visual width (number of visible characters)
 * @returns Truncated text with '...' at the beginning, ANSI codes preserved
 * 
 * @example
 * truncateStart('\x1b[31mHello World\x1b[0m', 8) // '...\x1b[31mWorld\x1b[0m'
 */
export function truncateStart(text: string, maxWidth: number): string {
  const plain = stripAnsi(text);
  if (plain.length <= maxWidth) {
    return text;
  }
  if (maxWidth <= 3) {
    return '.'.repeat(maxWidth);
  }
  // We need to truncate from the start, preserving ANSI codes
  // This is trickier - we need to work backwards
  const availableWidth = maxWidth - 3;
  const startIdx = plain.length - availableWidth;
  
  // Find the actual start position in the original string (accounting for ANSI codes)
  let visual = 0;
  let idx = 0;
  while (idx < text.length && visual < startIdx) {
    if (text[idx] === '\x1b') {
      let end = idx + 1;
      while (end < text.length && text[end] !== 'm') {
        end++;
      }
      if (end < text.length) {
        end++;
      }
      idx = end;
    } else {
      idx++;
      visual++;
    }
  }
  
  return '...' + text.substring(idx);
}

/**
 * Truncate text with ellipsis in the middle, preserving ANSI escape codes
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
  // Calculate how many characters we can show on each side
  // Total: start + 3 (ellipsis) + end = maxWidth
  const availableChars = maxWidth - 3; // Characters available for text (excluding ellipsis)
  const startChars = Math.floor(availableChars / 2);
  const endChars = availableChars - startChars;
  
  // Get start portion
  const startPortion = truncateToWidth(text, startChars);
  
  // Get end portion - work backwards from the end
  const endStartIdx = plain.length - endChars;
  
  // Find the actual start position in the original string (accounting for ANSI codes)
  let visual = 0;
  let idx = 0;
  while (idx < text.length && visual < endStartIdx) {
    if (text[idx] === '\x1b') {
      let end = idx + 1;
      while (end < text.length && text[end] !== 'm') {
        end++;
      }
      if (end < text.length) {
        end++;
      }
      idx = end;
    } else {
      idx++;
      visual++;
    }
  }
  
  const endPortion = text.substring(idx);
  
  return startPortion + '...' + endPortion;
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
    let visibleCount = 0;
    let end = index;
    
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
      } else {
        // Regular character - count it
        end++;
        visibleCount++;
      }
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
    if (text[idx] === '\x1b') {
      // Found start of ANSI escape sequence - skip to the end
      let end = idx + 1;
      while (end < text.length && text[end] !== 'm') {
        end++;
      }
      // Include the 'm' if found
      if (end < text.length) {
        end++;
      }
      idx = end;
    } else {
      // Regular character - count it
      idx++;
      count++;
    }
  }
  
  return count;
}

/**
 * Extract active ANSI codes from text (all codes that are active at the end)
 * Returns the ANSI escape sequences that should be applied to continue the styling
 */
function extractActiveAnsiCodes(text: string): string {
  const codes: string[] = [];
  let idx = 0;
  
  while (idx < text.length) {
    if (text[idx] === '\x1b' && idx + 1 < text.length && text[idx + 1] === '[') {
      // Found ANSI escape sequence
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
    } else {
      idx++;
    }
  }
  
  // Return all active codes combined
  return codes.join('');
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
    if (text[idx] === '\x1b') {
      // Found start of ANSI escape sequence - skip to the end
      let end = idx + 1;
      while (end < text.length && text[end] !== 'm') {
        end++;
      }
      // Include the 'm' if found
      if (end < text.length) {
        end++;
      }
      idx = end;
    } else {
      // Regular character - count it and advance
      idx++;
      visual++;
    }
  }
  
  const before = text.substring(0, idx);
  const after = text.substring(idx);
  
  // Extract active ANSI codes from the "before" part
  const activeCodes = extractActiveAnsiCodes(before);
  
  // If there are active codes, we need to:
  // 1. Close them in the "before" part (unless it already ends with a reset)
  // 2. Re-apply them at the start of the "after" part
  if (activeCodes && !before.endsWith('\x1b[0m')) {
    return {
      before: before + '\x1b[0m',
      after: activeCodes + after
    };
  }
  
  return { before, after };
}
