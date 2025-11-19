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
  // Calculate how many characters we can show on each side
  // Total: start + 3 (ellipsis) + end = maxWidth
  const availableChars = maxWidth - 3; // Characters available for text (excluding ellipsis)
  const start = Math.floor(availableChars / 2);
  const end = text.length - (availableChars - start);
  return text.slice(0, start) + '...' + text.slice(end);
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
  // Remove ANSI escape codes
  const ansiRegex = /\x1b\[[0-9;]*m/g;
  const plain = text.replace(ansiRegex, '');
  return plain.length;
}

export function getTrimmedTextWidth(text: string): number {
  const ansiRegex = /\x1b\[[0-9;]*m/g;
  const plain = text.replace(ansiRegex, '');
  const trimmed = plain.replace(/\s+$/u, '');
  return trimmed.length;
}

