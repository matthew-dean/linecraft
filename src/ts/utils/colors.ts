import { Color, TextStyle } from '../types';

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
};

export function applyStyle(text: string, style?: TextStyle): string {
  if (!style) return text;

  const codes: string[] = [];

  if (style.color) {
    codes.push(ANSI_COLORS[style.color]);
  }

  if (style.backgroundColor) {
    codes.push(ANSI_BG_COLORS[style.backgroundColor]);
  }

  if (style.bold) {
    codes.push('1');
  }

  if (style.italic) {
    codes.push('3');
  }

  if (style.underline) {
    codes.push('4');
  }

  if (codes.length === 0) {
    return text;
  }

  return `\x1b[${codes.join(';')}m${text}\x1b[0m`;
}

