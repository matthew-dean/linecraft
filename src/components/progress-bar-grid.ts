// Progress bar component using grid system

import type { Component, RenderContext } from '../layout/grid';
import type { Color } from '../types';
import { style } from './style';
import { grid as gridComponent } from '../layout/grid';
import { applyStyle } from '../utils/colors';

export interface ProgressBarOptions {
  current: number;
  total: number;
  label?: string;
  labelColor?: Color;
  barColor?: Color;
  bracketColor?: Color;
  percentColor?: Color;
  completeChar?: string;
  incompleteChar?: string;
  brackets?: [string, string];
}

/**
 * Create a progress bar component using grid
 * Uses grid internally to layout: [bracket] [bar (flex)] [bracket] [percent]
 */
export function progressBar(options: ProgressBarOptions): Component {
  return (ctx: RenderContext) => {
    const percent = Math.min(100, Math.max(0, (options.current / options.total) * 100));
    
    const completeChar = options.completeChar ?? '━';
    const incompleteChar = options.incompleteChar ?? '─';
    const leftBracket = options.brackets?.[0] ?? '\u263E'; // ☾
    const rightBracket = options.brackets?.[1] ?? '\u263D'; // ☽
    
    const bracketColor = options.bracketColor ?? 'brightBlack';
    
    // Use grid to layout: left bracket (1), bar (flex), right bracket (1), percent (6)
    // The bar column will receive its allocated width and calculate fill based on that
    const barComponent = (barCtx: RenderContext): string => {
      // Calculate bar based on allocated width (minus padding spaces)
      const availableBarWidth = Math.max(0, barCtx.availableWidth - 2); // minus padding spaces
      const filled = Math.floor((percent / 100) * availableBarWidth);
      const empty = availableBarWidth - filled;
      
      const filledBar = completeChar.repeat(filled);
      const emptyBar = incompleteChar.repeat(empty);
      
      const barText = ' ' + 
        (options.barColor ? applyStyle(filledBar, { color: options.barColor }) : filledBar) +
        applyStyle(emptyBar, { color: 'brightBlack' }) + 
        ' ';
      
      return barText;
    };
    
    // Build grid children
    const children = [
      style({ color: bracketColor }, leftBracket),
      barComponent,
      style({ color: bracketColor }, rightBracket),
      style({ color: options.percentColor ?? 'brightBlack' }, percent.toFixed(1) + '%'),
    ];
    
    // Use grid to layout: [1] [flex] [1] [7]
    const gridComp = gridComponent({ template: [1, '1*', 1, 7], columnGap: 0 }, ...children);
    return gridComp(ctx);
  };
}

