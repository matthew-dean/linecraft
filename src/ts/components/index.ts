// Component helpers and utilities

// Re-export component classes
export { ProgressBar } from './progress-bar.js';
export { Spinner } from './spinner.js';
export { Col } from './col.js';

import { applyStyle } from '../utils/colors.js';
import type { Color } from '../types.js';

// Helper functions that return strings
export function progressBar(options: { 
  current: number; 
  total: number; 
  label?: string; 
  width?: number;
  labelColor?: Color;
  barColor?: Color;
  bracketColor?: Color;
  percentColor?: Color;
}): string {
  const percent = Math.min(100, Math.max(0, (options.current / options.total) * 100));
  const barWidth = options.width ?? 40;
  const filled = Math.floor((percent / 100) * barWidth);
  const empty = barWidth - filled;
  
  // Use thick line for filled (green), thin line for empty (grey)
  // ━ = thick horizontal line (U+2501), ─ = thin horizontal line (U+2500)
  const filledBar = '━'.repeat(filled);
  const emptyBar = '─'.repeat(empty);
  const bar = filledBar + emptyBar;
  
  // Use moon symbols for brackets: ☾ ☽ (U+263E, U+263D) - facing each other, subtle and elegant
  const leftBracket = '\u263E';  // ☾ (facing right, toward center)
  const rightBracket = '\u263D'; // ☽ (facing left, toward center)
  
  // Apply colors using the color system
  const label = options.label ? (options.labelColor ? applyStyle(options.label, { color: options.labelColor }) + ' ' : options.label + ' ') : '';
  
  // Style brackets (default to grey/brightBlack)
  const bracketColor = options.bracketColor ?? 'brightBlack';
  const leftBracketStyled = applyStyle(leftBracket, { color: bracketColor });
  const rightBracketStyled = applyStyle(rightBracket, { color: bracketColor });
  
  // Style bar: filled part gets barColor (default green), empty part gets grey
  const filledBarStyled = options.barColor ? applyStyle(filledBar, { color: options.barColor }) : filledBar;
  const emptyBarStyled = applyStyle(emptyBar, { color: 'brightBlack' }); // Always grey for empty
  const barStyled = filledBarStyled + emptyBarStyled;
  
  // Style percentage
  const percentText = percent.toFixed(1) + '%';
  const percentColor = options.percentColor ?? 'brightBlack';
  const percentStyled = applyStyle(percentText, { color: percentColor });
  
  // Add padding: space before and after the bar
  return `${label}${leftBracketStyled} ${barStyled} ${rightBracketStyled} ${percentStyled}`;
}

export function spinner(text?: string): string {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  // Returns first frame for static use
  // For animated spinners, use the Spinner component class
  return `${frames[0]} ${text || ''}`;
}

