// ASCII drawing primitives - boxes, lines, etc.

/**
 * Draw a rounded box
 */
export function drawRoundedBox(
  width: number,
  height: number,
  options: BoxOptions = {}
): string[] {
  const {
    topLeft = '╭',
    topRight = '╮',
    bottomLeft = '╰',
    bottomRight = '╯',
    horizontal = '─',
    vertical = '│',
  } = options;

  const lines: string[] = [];
  
  // Top border
  lines.push(topLeft + horizontal.repeat(Math.max(0, width - 2)) + topRight);
  
  // Middle lines
  for (let i = 1; i < height - 1; i++) {
    lines.push(vertical + ' '.repeat(Math.max(0, width - 2)) + vertical);
  }
  
  // Bottom border
  if (height > 1) {
    lines.push(bottomLeft + horizontal.repeat(Math.max(0, width - 2)) + bottomRight);
  }
  
  return lines;
}

/**
 * Draw a double-line box
 */
export function drawDoubleBox(
  width: number,
  height: number
): string[] {
  return drawRoundedBox(width, height, {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
  });
}

/**
 * Draw a single-line box
 */
export function drawSingleBox(
  width: number,
  height: number
): string[] {
  return drawRoundedBox(width, height, {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
  });
}

/**
 * Draw horizontal line with smooth characters
 */
export function drawHorizontalLine(
  width: number,
  style: 'single' | 'double' | 'thick' | 'dashed' = 'single'
): string {
  const chars = {
    single: '─',
    double: '═',
    thick: '━',
    dashed: '┄',
  };
  return chars[style].repeat(width);
}

/**
 * Draw vertical line
 */
export function drawVerticalLine(
  height: number,
  style: 'single' | 'double' | 'thick' = 'single'
): string[] {
  const chars = {
    single: '│',
    double: '║',
    thick: '┃',
  };
  return Array(height).fill(chars[style]);
}

/**
 * Draw a divider line
 */
export function drawDivider(
  width: number,
  style: 'single' | 'double' | 'thick' | 'dashed' = 'single',
  left: string = '',
  right: string = ''
): string {
  const line = drawHorizontalLine(width - left.length - right.length, style);
  return left + line + right;
}

export interface BoxOptions {
  topLeft?: string;
  topRight?: string;
  bottomLeft?: string;
  bottomRight?: string;
  horizontal?: string;
  vertical?: string;
}

