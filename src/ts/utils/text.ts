// Text utilities for handling overflow, ellipsis, etc.

/**
 * Truncate text with ellipsis at the end
 */
export function truncateEnd(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) {
    return text;
  }
  if (maxWidth <= 3) {
    return '.'.repeat(maxWidth);
  }
  return text.slice(0, maxWidth - 3) + '...';
}

/**
 * Truncate text with ellipsis at the beginning
 */
export function truncateStart(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) {
    return text;
  }
  if (maxWidth <= 3) {
    return '.'.repeat(maxWidth);
  }
  return '...' + text.slice(text.length - (maxWidth - 3));
}

/**
 * Truncate text with ellipsis in the middle
 */
export function truncateMiddle(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) {
    return text;
  }
  if (maxWidth <= 3) {
    return '.'.repeat(maxWidth);
  }
  const start = Math.floor((maxWidth - 3) / 2);
  const end = text.length - (maxWidth - 3 - start);
  return text.slice(0, start) + '...' + text.slice(end);
}

/**
 * Wrap text to fit within a width, breaking on spaces
 */
export function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  const words = text.split(/\s+/);
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // If word is longer than width, break it
      if (word.length > width) {
        let remaining = word;
        while (remaining.length > width) {
          lines.push(remaining.slice(0, width));
          remaining = remaining.slice(width);
        }
        currentLine = remaining;
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * Get the visual width of text (accounting for ANSI codes)
 */
export function getTextWidth(text: string): number {
  // Remove ANSI escape codes
  const ansiRegex = /\x1b\[[0-9;]*m/g;
  return text.replace(ansiRegex, '').length;
}

