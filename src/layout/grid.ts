// CSS Grid-based layout system for terminal components
// Simplified grid that eliminates circular measurement complexity

import type { TerminalRegion } from '../region';
import type { Color } from '../types';
import { applyStyle } from '../utils/colors';
import { truncateEnd, truncateStart, truncateMiddle, wrapText } from '../utils/text';

/**
 * RenderContext provides information needed for rendering
 */
export interface RenderContext {
  availableWidth: number;  // Width allocated to this component
  region: TerminalRegion;  // For setLine access (needed for multi-line)
  columnIndex: number;     // Which grid column (0-based)
  rowIndex: number;         // Which grid row (0-based, for multi-line)
}

/**
 * Component type: function that takes RenderContext and returns string(s) or null
 */
export type Component = (ctx: RenderContext) => string | string[] | null;

/**
 * Grid template entry: fixed width, flex unit, or minmax
 */
export type GridTemplateEntry = 
  | number  // Fixed width: 20
  | string  // Flex unit: '1*', '2*'
  | { min: number; width: string };  // Minmax: { min: 40, width: '2*' }

export interface GridOptions {
  /** Column template: fixed widths, flex units, or minmax */
  template: GridTemplateEntry[];
  
  /** Spaces between columns (default: 0) */
  columnGap?: number;
  
  /** Characters to draw between columns (fills blank space until next column) */
  spaceBetween?: string | string[] | { char: string; color?: Color };
  
  /** Justify content: 'space-between' for left/right items with flexing middle */
  justify?: 'start' | 'end' | 'center' | 'space-between';
}

/**
 * Parse template entry into track size info
 */
interface TrackSize {
  type: 'fixed' | 'flex' | 'minmax';
  value: number;  // Fixed width, or flex ratio, or min width
  flexRatio?: number;  // For flex and minmax
}

function parseTemplateEntry(entry: GridTemplateEntry): TrackSize {
  if (typeof entry === 'number') {
    return { type: 'fixed', value: entry };
  }
  
  if (typeof entry === 'string') {
    // Parse flex unit: '1*', '2*', etc.
    const match = entry.match(/^(\d+)\*$/);
    if (match) {
      return { type: 'flex', value: 0, flexRatio: parseInt(match[1], 10) };
    }
    throw new Error(`Invalid flex unit: ${entry}. Use format like '1*', '2*'`);
  }
  
  // Minmax: { min: 40, width: '2*' }
  const match = entry.width.match(/^(\d+)\*$/);
  if (match) {
    return {
      type: 'minmax',
      value: entry.min,
      flexRatio: parseInt(match[1], 10),
    };
  }
  throw new Error(`Invalid minmax width: ${entry.width}. Use format like '2*'`);
}

/**
 * Calculate column widths from template
 * Reference: https://www.w3.org/TR/css-grid-1/#track-sizing
 */
function calculateColumnWidths(
  template: GridTemplateEntry[],
  availableWidth: number,
  columnGap: number,
  numChildren: number
): number[] {
  // Expand template if needed (repeat last value)
  const expandedTemplate: GridTemplateEntry[] = [];
  for (let i = 0; i < numChildren; i++) {
    if (i < template.length) {
      expandedTemplate.push(template[i]);
    } else {
      // Repeat last template value
      expandedTemplate.push(template[template.length - 1] ?? '1*');
    }
  }
  
  // If template is empty, use equal flex for all
  if (expandedTemplate.length === 0) {
    expandedTemplate.push('1*');
  }
  
  // Parse all template entries
  const tracks: TrackSize[] = expandedTemplate.map(parseTemplateEntry);
  
  // Step 1: Calculate fixed track sizes
  let fixedTotal = 0;
  let flexTotal = 0;
  const widths: number[] = new Array(tracks.length);
  
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    if (track.type === 'fixed') {
      widths[i] = track.value;
      fixedTotal += track.value;
    } else if (track.type === 'flex') {
      widths[i] = 0;  // Will be calculated
      flexTotal += track.flexRatio ?? 1;
    } else if (track.type === 'minmax') {
      widths[i] = track.value;  // Start with min
      fixedTotal += track.value;
      flexTotal += track.flexRatio ?? 1;
    }
  }
  
  // Step 2: Calculate gap space
  const gapSpace = columnGap * (tracks.length - 1);
  const remainingSpace = availableWidth - fixedTotal - gapSpace;
  
  // Step 3: Distribute remaining space to flex tracks proportionally
  if (flexTotal > 0 && remainingSpace > 0) {
    const flexUnit = remainingSpace / flexTotal;
    
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (track.type === 'flex') {
        widths[i] = (track.flexRatio ?? 1) * flexUnit;
      } else if (track.type === 'minmax') {
        // Add flex space to min width
        widths[i] = track.value + (track.flexRatio ?? 1) * flexUnit;
      }
    }
  }
  
  // Step 4: Round to integers
  return widths.map(w => Math.floor(w));
}

/**
 * Grid component that renders to region (like flex)
 * This is the internal implementation
 */
export interface GridComponent {
  getHeight(): number;
  render(x: number, y: number, width: number): void;
}

/**
 * Create a grid component that renders to region
 */
export function createGrid(
  region: TerminalRegion,
  options: GridOptions,
  ...children: Component[]
): GridComponent {
  return {
    getHeight(): number {
      // Calculate height by rendering children and checking for multi-line
      const { template, columnGap = 0 } = options;
      const validChildren = children.filter(c => c !== null && c !== undefined);
      
      if (validChildren.length === 0) {
        return 0;
      }
      
      const columnWidths = calculateColumnWidths(
        template,
        region.width,
        columnGap,
        validChildren.length
      );
      
      let maxLines = 1;
      for (let i = 0; i < validChildren.length; i++) {
        const child = validChildren[i];
        const width = columnWidths[i] ?? 0;
        
        const childCtx: RenderContext = {
          availableWidth: width,
          region: region,
          columnIndex: i,
          rowIndex: 0,
        };
        
        const result = child(childCtx);
        if (result !== null) {
          const lines = Array.isArray(result) ? result.length : 1;
          maxLines = Math.max(maxLines, lines);
        }
      }
      
      return maxLines;
    },
    
    render(x: number, y: number, width: number): void {
      const { template, columnGap = 0, spaceBetween, justify = 'start' } = options;
      
      // Filter out null children
      const validChildren = children.filter(c => c !== null && c !== undefined);
      
      if (validChildren.length === 0) {
        return;
      }
      
      // Calculate column widths
      const columnWidths = calculateColumnWidths(
        template,
        width,
        columnGap,
        validChildren.length
      );
      
      // Handle justify: 'space-between'
      let startX = x;
      let actualWidths = columnWidths;
      
      if (justify === 'space-between' && validChildren.length > 1) {
        const firstWidth = columnWidths[0];
        const lastWidth = columnWidths[columnWidths.length - 1];
        const middleTotal = columnWidths.slice(1, -1).reduce((sum, w) => sum + w, 0);
        const middleFlex = width - firstWidth - lastWidth - (columnGap * (validChildren.length - 1));
        
        actualWidths = [firstWidth];
        for (let i = 1; i < columnWidths.length - 1; i++) {
          const ratio = middleTotal > 0 ? columnWidths[i] / middleTotal : 1 / (columnWidths.length - 2);
          actualWidths.push(Math.floor(middleFlex * ratio));
        }
        actualWidths.push(lastWidth);
      }
      
      // Render each child and collect results
      const results: (string | string[] | null)[] = [];
      let currentX = startX;
      
      for (let i = 0; i < validChildren.length; i++) {
        const child = validChildren[i];
        const childWidth = actualWidths[i] ?? 0;
        
        // Create context for child
        const childCtx: RenderContext = {
          availableWidth: childWidth,
          region: region,
          columnIndex: i,
          rowIndex: 0,
        };
        
        // Render child
        const result = child(childCtx);
        results.push(result);
        
        // Handle spaceBetween
        if (i < validChildren.length - 1 && spaceBetween) {
          const spaceChar = typeof spaceBetween === 'string' 
            ? spaceBetween 
            : Array.isArray(spaceBetween)
            ? (spaceBetween[i] ?? spaceBetween[spaceBetween.length - 1])
            : spaceBetween.char;
          const spaceColor = typeof spaceBetween === 'object' && !Array.isArray(spaceBetween)
            ? spaceBetween.color
            : undefined;
          
          const gapText = spaceChar.repeat(columnGap);
          results.push(spaceColor ? applyStyle(gapText, { color: spaceColor }) : gapText);
        }
        
        currentX += childWidth + columnGap;
      }
      
      // Handle multi-line: if any result is string[], expand grid vertically
      const maxLines = Math.max(
        ...results.map(r => Array.isArray(r) ? r.length : 1),
        1
      );
      
      // Render line by line
      for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
        const lineParts: string[] = [];
        let partIdx = 0;
        
        for (let i = 0; i < validChildren.length; i++) {
          const result = results[partIdx];
          partIdx++;
          
          if (result === null) {
            // Null result - add empty space
            lineParts.push('');
            continue;
          }
          
          if (Array.isArray(result)) {
            lineParts.push(result[lineIdx] ?? '');
          } else {
            lineParts.push(lineIdx === 0 ? result : '');
          }
          
          // Add gap (spaceBetween or spaces) if not last
          if (i < validChildren.length - 1 && columnGap > 0) {
            if (spaceBetween) {
              const spaceChar = typeof spaceBetween === 'string' 
                ? spaceBetween 
                : Array.isArray(spaceBetween)
                ? (spaceBetween[i] ?? spaceBetween[spaceBetween.length - 1])
                : spaceBetween.char;
              const spaceColor = typeof spaceBetween === 'object' && !Array.isArray(spaceBetween)
                ? spaceBetween.color
                : undefined;
              
              const gapText = spaceChar.repeat(columnGap);
              lineParts.push(spaceColor ? applyStyle(gapText, { color: spaceColor }) : gapText);
              partIdx++; // spaceBetween adds an extra result
            } else {
              // Just add spaces for columnGap
              lineParts.push(' '.repeat(columnGap));
            }
          }
        }
        
        const line = lineParts.join('');
        const lineY = y + lineIdx;
        
        // CRITICAL: Pad line to full width to ensure grid fills the region
        // This ensures grids are always full-width by default
        const plainLine = line.replace(/\x1b\[[0-9;]*m/g, '');
        const paddedLine = plainLine.length < width 
          ? line + ' '.repeat(width - plainLine.length)
          : line;
        
        // For now, just set the line (we can add merging later if needed)
        region.setLine(lineY, paddedLine);
      }
    },
  };
}

/**
 * Create a grid component (function-based API)
 * This returns a Component that can be used in other grids
 */
export function grid(
  options: GridOptions,
  ...children: Component[]
): Component {
  return (ctx: RenderContext) => {
    const { template, columnGap = 0, spaceBetween, justify = 'start' } = options;
    
    // Filter out null children (from when conditions)
    const validChildren = children.filter(c => c !== null && c !== undefined);
    
    if (validChildren.length === 0) {
      return null;
    }
    
    // Calculate column widths
    const columnWidths = calculateColumnWidths(
      template,
      ctx.availableWidth,
      columnGap,
      validChildren.length
    );
    
    // Handle justify: 'space-between'
    let startX = 0;
    let actualWidths = columnWidths;
    
    if (justify === 'space-between' && validChildren.length > 1) {
      // First and last get their widths, middle flexes
      const firstWidth = columnWidths[0];
      const lastWidth = columnWidths[columnWidths.length - 1];
      const middleTotal = columnWidths.slice(1, -1).reduce((sum, w) => sum + w, 0);
      const middleFlex = ctx.availableWidth - firstWidth - lastWidth - (columnGap * (validChildren.length - 1));
      
      actualWidths = [firstWidth];
      for (let i = 1; i < columnWidths.length - 1; i++) {
        // Distribute middle space proportionally
        const ratio = columnWidths[i] / middleTotal;
        actualWidths.push(Math.floor(middleFlex * ratio));
      }
      actualWidths.push(lastWidth);
    }
    
    // Render each child
    const results: (string | string[] | null)[] = [];
    let currentX = startX;
    
    for (let i = 0; i < validChildren.length; i++) {
      const child = validChildren[i];
      const width = actualWidths[i] ?? 0;
      
      // Create context for child
      const childCtx: RenderContext = {
        availableWidth: width,
        region: ctx.region,
        columnIndex: i,
        rowIndex: 0,
      };
      
      // Render child
      const result = child(childCtx);
      results.push(result);
      
      // Handle gap (spaceBetween or spaces)
      if (i < validChildren.length - 1 && columnGap > 0) {
        if (spaceBetween) {
          const spaceChar = typeof spaceBetween === 'string' 
            ? spaceBetween 
            : Array.isArray(spaceBetween)
            ? (spaceBetween[i] ?? spaceBetween[spaceBetween.length - 1])
            : spaceBetween.char;
          const spaceColor = typeof spaceBetween === 'object' && !Array.isArray(spaceBetween)
            ? spaceBetween.color
            : undefined;
          
          // Fill gap with space character
          const gapText = spaceChar.repeat(columnGap);
          results.push(spaceColor ? applyStyle(gapText, { color: spaceColor }) : gapText);
        } else {
          // Just add spaces for columnGap
          results.push(' '.repeat(columnGap));
        }
      }
      
      currentX += width + columnGap;
    }
    
    // Handle multi-line: if any result is string[], expand grid vertically
    const maxLines = Math.max(
      ...results.map(r => Array.isArray(r) ? r.length : 1),
      1
    );
    
    if (maxLines === 1) {
      // Single line - join all results
      const filtered = results.filter(r => r !== null);
      if (filtered.length === 0) {
        return null;
      }
      const line = filtered.join('');
      // CRITICAL: Pad line to full availableWidth to ensure grid fills the region
      const plainLine = line.replace(/\x1b\[[0-9;]*m/g, '');
      const paddedLine = plainLine.length < ctx.availableWidth 
        ? line + ' '.repeat(ctx.availableWidth - plainLine.length)
        : line;
      return paddedLine;
    }
    
    // Multi-line - combine line by line
    const lines: string[] = [];
    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      const lineParts: string[] = [];
      let partIdx = 0;
      
      for (let i = 0; i < validChildren.length; i++) {
        const result = results[partIdx];
        partIdx++;
        
        if (result === null) continue;
        
        if (Array.isArray(result)) {
          lineParts.push(result[lineIdx] ?? '');
        } else {
          lineParts.push(lineIdx === 0 ? result : '');
        }
        
        // Add gap (spaceBetween or spaces) if not last
        if (i < validChildren.length - 1 && columnGap > 0) {
          if (spaceBetween) {
            const spaceChar = typeof spaceBetween === 'string' 
              ? spaceBetween 
              : Array.isArray(spaceBetween)
              ? (spaceBetween[i] ?? spaceBetween[spaceBetween.length - 1])
              : spaceBetween.char;
            const spaceColor = typeof spaceBetween === 'object' && !Array.isArray(spaceBetween)
              ? spaceBetween.color
              : undefined;
            
            const gapText = spaceChar.repeat(columnGap);
            lineParts.push(spaceColor ? applyStyle(gapText, { color: spaceColor }) : gapText);
            partIdx++; // spaceBetween adds an extra result
          } else {
            // Just add spaces for columnGap
            lineParts.push(' '.repeat(columnGap));
          }
        }
      }
      
      const line = lineParts.join('');
      // CRITICAL: Pad line to full width to ensure grid fills the region
      const plainLine = line.replace(/\x1b\[[0-9;]*m/g, '');
      const paddedLine = plainLine.length < ctx.availableWidth 
        ? line + ' '.repeat(ctx.availableWidth - plainLine.length)
        : line;
      lines.push(paddedLine);
    }
    
    return lines;
  };
}

