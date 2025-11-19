export type Color = 
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'brightBlack'
  | 'brightRed'
  | 'brightGreen'
  | 'brightYellow'
  | 'brightBlue'
  | 'brightMagenta'
  | 'brightCyan'
  | 'brightWhite';

export interface TextStyle {
  color?: Color;
  backgroundColor?: Color;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface LineContent {
  text: string;
  style?: TextStyle;
}

export interface RegionOptions {
  width?: number; // If not specified, region auto-resizes with terminal
  height?: number; // Default: 1 (expands as needed)
  stdout?: NodeJS.WriteStream; // Default: process.stdout
  disableRendering?: boolean; // For tests - prevents actual rendering
}

export interface ProgressBarOptions {
  label?: string;
  width?: number;
  style?: {
    complete?: string;
    incomplete?: string;
    brackets?: [string, string];
  };
}

export interface SpinnerOptions {
  frames?: string[];
  interval?: number;
}

/**
 * Character with optional color - used for fill components and spaceBetween
 * Can be a simple string or an object with char and color
 */
export type FillChar = string | { char: string; color?: Color };

/**
 * Base options for all components - includes common styling props
 */
export interface BaseComponentOptions {
  color?: Color; // Text color
}

