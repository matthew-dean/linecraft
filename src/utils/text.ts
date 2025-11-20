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
 */
export function wrapText(text: string, width: number): string[] {
  if (!Number.isFinite(width) || width <= 0) {
    return text.length > 0 ? [text] : [''];
  }

  const lines: string[] = [];
  const length = text.length;
  let index = 0;

  while (index < length) {
    // Skip leading spaces
    while (index < length && text[index] === ' ') {
      index++;
    }
    if (index >= length) {
      break;
    }

    let end = Math.min(length, index + width);

    if (end === length) {
      lines.push(text.slice(index));
      break;
    }

    let breakPoint = -1;
    for (let i = end; i > index; i--) {
      const char = text[i - 1];
      if (char === ' ') {
        breakPoint = i - 1;
        break;
      }
      if (char === '-') {
        breakPoint = i;
        break;
      }
    }

    if (breakPoint === -1) {
      breakPoint = end;
    }

    const line = text.slice(index, breakPoint).trimEnd();
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

