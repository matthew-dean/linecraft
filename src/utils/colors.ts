import { Color, TextStyle } from '../types.js';
import { isAutoColor, autoStyle } from './terminal-theme.js';

const ANSI_COLORS: Record<Color, string> = {
  black: '30',
  red: '31',
  green: '32',
  yellow: '33',
  blue: '34',
  magenta: '35',
  cyan: '36',
  white: '37',
  brightBlack: '90',
  brightRed: '91',
  brightGreen: '92',
  brightYellow: '93',
  brightBlue: '94',
  brightMagenta: '95',
  brightCyan: '96',
  brightWhite: '97',
  gray: '90',
  grey: '90',
};

const ANSI_BG_COLORS: Record<Color, string> = {
  black: '40',
  red: '41',
  green: '42',
  yellow: '43',
  blue: '44',
  magenta: '45',
  cyan: '46',
  white: '47',
  brightBlack: '100',
  brightRed: '101',
  brightGreen: '102',
  brightYellow: '103',
  brightBlue: '104',
  brightMagenta: '105',
  brightCyan: '106',
  brightWhite: '107',
  gray: '100',
  grey: '100',
};

function getColorCode(color: string, isBackground: boolean = false): string {
  // Named ANSI colors
  if (color in ANSI_COLORS && !isBackground) {
    return ANSI_COLORS[color as Color];
  }
  if (color in ANSI_BG_COLORS && isBackground) {
    return ANSI_BG_COLORS[color as Color];
  }

  // 256 colors: "5;N" where N is 0-255
  if (/^\d+$/.test(color)) {
    return `${isBackground ? '48' : '38'};5;${color}`;
  }

  // hex colors: "#RRGGBB"
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `${isBackground ? '48' : '38'};2;${r};${g};${b}`;
  }

  // Fallback to basic white or ignore
  return isBackground ? '40' : '37';
}

export function applyStyle(text: string, style?: TextStyle): string {
  if (!style) return text;

  // Resolve semantic tokens if provided
  let resolvedStyle: TextStyle = { ...style };

  if (style.color && isAutoColor(style.color)) {
    const semanticStyle = autoStyle(style.color);
    // Merge semantic style (color, bold, dim, etc.) but let specific overrides in 'style' win
    resolvedStyle = { ...semanticStyle, ...style };
    // The 'color' property in resolvedStyle is currently the token name, resolve it to the actual color
    resolvedStyle.color = semanticStyle.color;
  }

  if (style.backgroundColor && isAutoColor(style.backgroundColor)) {
    const semanticBgStyle = autoStyle(style.backgroundColor);
    resolvedStyle.backgroundColor = semanticBgStyle.color;
  }

  const codes: string[] = [];

  if (resolvedStyle.color) {
    const code = getColorCode(resolvedStyle.color as string, false);
    codes.push(code);
  }

  if (resolvedStyle.backgroundColor) {
    const bgCode = getColorCode(resolvedStyle.backgroundColor as string, true);
    codes.push(bgCode);
  }

  if (resolvedStyle.bold) {
    codes.push('1');
  }

  if (resolvedStyle.dim) {
    codes.push('2'); // Dim/faint intensity
  }

  if (resolvedStyle.italic) {
    codes.push('3');
  }

  if (resolvedStyle.underline) {
    codes.push('4');
  }

  if (codes.length === 0) {
    return text;
  }

  return `\x1b[${codes.join(';')}m${text}\x1b[0m`;
}

