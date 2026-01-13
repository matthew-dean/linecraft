import type { Color, TextStyle } from '../types.js';

// Terminal theme detection utilities

/**
 * Detect if the terminal has a dark or light background
 */
export function isDarkTerminal(): boolean {
  if (process.env.TERMINAL_THEME === 'light') return false;
  if (process.env.TERMINAL_THEME === 'dark') return true;

  const colorfgbg = process.env.COLORFGBG;
  if (!colorfgbg) {
    return true;
  }

  const parts = colorfgbg.split(';');
  const background = parts.length > 1 ? parts[1] : parts[0];
  const bgNum = parseInt(background, 10);

  if (isNaN(bgNum)) {
    return true;
  }

  return bgNum < 8;
}

/**
 * Resolve a value based on the current terminal theme
 */
export function resolveThemeColor<T>(
  colors: { dark: T; light: T },
  forceTheme?: 'dark' | 'light'
): T {
  if (forceTheme === 'dark') return colors.dark;
  if (forceTheme === 'light') return colors.light;
  return isDarkTerminal() ? colors.dark : colors.light;
}

export type AutoColor = 'base' | 'muted' | 'highlight' | 'accent' | 'warning' | 'error' | 'info' | 'location' | 'success';

const semanticPalette: Record<AutoColor, { dark: TextStyle; light: TextStyle }> = {
  base: { 
    dark: { color: 'gray' }, 
    light: { color: 'gray' } 
  },
  muted: { 
    dark: { color: 'white', dim: true }, 
    light: { color: 'gray', dim: true } 
  },
  highlight: { 
    dark: { color: 'white' }, 
    light: { color: 'black', bold: true } 
  },
  accent: { 
    dark: { color: 'blue', bold: true }, 
    light: { color: 'blue', bold: true } 
  },
  location: {
    dark: { color: 'magenta' },
    light: { color: 'magenta' }
  },
  success: {
    dark: { color: 'brightGreen' },
    light: { color: 'green' }
  },
  warning: { 
    dark: { color: 'brightYellow' }, 
    light: { color: 'brightMagenta' } 
  },
  error: { 
    dark: { color: 'brightRed' }, 
    light: { color: 'red' } 
  },
  info: { 
    dark: { color: 'blue' }, 
    light: { color: 'blue' } 
  },
};

const autoColorSet = new Set(['base', 'muted', 'highlight', 'accent', 'warning', 'error', 'info', 'location', 'success']);

/**
 * Checks if a string is a semantic auto-color token
 */
export function isAutoColor(color: string): color is AutoColor {
  return autoColorSet.has(color);
}

/**
 * Automatically picks the right ANSI color for a semantic token based on light/dark theme
 */
export function autoColor(token: AutoColor, override?: 'dark' | 'light'): Color {
  return autoStyle(token, override).color as Color;
}

/**
 * Automatically picks the right full style for a semantic token
 */
export function autoStyle(token: AutoColor, override?: 'dark' | 'light'): TextStyle {
  const choice = semanticPalette[token];
  return resolveThemeColor(choice, override);
}
