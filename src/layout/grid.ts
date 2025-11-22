// CSS Grid-based layout system for terminal components
// Simplified grid that eliminates circular measurement complexity

import type { Color, FillChar } from '../types';
import { applyStyle } from '../utils/colors';
import { truncateEnd, truncateStart, truncateMiddle, wrapText, getTrimmedTextWidth, stripAnsi } from '../utils/text';
import type { RenderContext, Component } from '../component';
import { callComponent, createChildContext } from '../component';

/**
 * Extract character and color from spaceBetween option for a specific gap index
 * spaceBetween can be a FillChar, or an array of FillChar values
 */
function getSpaceBetweenChar(
  spaceBetween: FillChar | FillChar[],
  gapIndex: number
): { char: string; color?: Color } {
  if (typeof spaceBetween === 'string') {
    return { char: spaceBetween };
  }
  
  if (Array.isArray(spaceBetween)) {
    const item = spaceBetween[gapIndex] ?? spaceBetween[spaceBetween.length - 1];
    if (typeof item === 'string') {
      return { char: item };
    }
    return { char: item.char, color: item.color };
  }
  
  // Single object
  return { char: spaceBetween.char, color: spaceBetween.color };
}


/**
 * Grid template entry: fixed width, flex unit, or minmax
 */
export type GridTemplateEntry = 
  | number  // Fixed width: 20
  | 'auto'  // Auto width (fit content)
  | '*'  // Flex unit shorthand (same as '1*')
  | `${number}*`  // Flex unit: '1*', '2*'
  | { min: number; width: string };  // Minmax: { min: 40, width: '2*' }

export interface GridOptions {
  /** Explicit column definitions (like CSS grid-template-columns) */
  columns?: GridTemplateEntry[];
  
  /** Size for implicitly created columns when there are more children than explicit columns (like CSS grid-auto-columns) */
  autoColumns?: GridTemplateEntry;
  
  /** 
   * Column template (deprecated, use `columns` + `autoColumns` instead)
   * When using `template`, the last value acts as the `autoColumns` value for implicitly created columns.
   * Example: `template: [20, 20]` means 2 explicit columns of 20, and auto columns will also be 20.
   */
  template?: GridTemplateEntry[];
  
  /** 
   * Explicit row definitions (like CSS grid-template-rows)
   * If not specified, rows are created automatically as needed (auto-wrapping).
   * When specified, children wrap to new rows when explicit columns are filled.
   */
  rows?: number[]; // Row heights in lines (e.g., [1, 1] for two 1-line rows)
  
  /** 
   * Height for implicitly created rows when there are more children than explicit rows (like CSS grid-auto-rows)
   * Defaults to 1 line if not specified.
   */
  autoRows?: number;
  
  /** Spaces between columns (default: 0) */
  columnGap?: number;
  
  /** Spaces between rows (default: 0) */
  rowGap?: number;
  
  /** Characters to draw between columns (fills blank space until next column) */
  spaceBetween?: FillChar | FillChar[];
  
  /** Justify content: 'space-between' for left/right items with flexing middle */
  justify?: 'start' | 'end' | 'center' | 'space-between';
}

/**
 * Parse template entry into track size info
 */
interface TrackSize {
  type: 'fixed' | 'flex' | 'minmax' | 'auto';
  value: number;  // Fixed width, or flex ratio, or min width
  flexRatio?: number;  // For flex and minmax
}

function parseTemplateEntry(entry: GridTemplateEntry): TrackSize {
  if (typeof entry === 'number') {
    return { type: 'fixed', value: entry };
  }
  
  if (entry === 'auto') {
    return { type: 'auto', value: 0 };
  }
  
  if (typeof entry === 'string') {
    // Shorthand: '*' means '1*'
    if (entry === '*') {
      return { type: 'flex', value: 0, flexRatio: 1 };
    }
    // Parse flex unit: '1*', '2*', etc.
    const match = entry.match(/^(\d+)\*$/);
    if (match) {
      return { type: 'flex', value: 0, flexRatio: parseInt(match[1], 10) };
    }
    throw new Error(`Invalid flex unit: ${entry}. Use format like '*', '1*', '2*'`);
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
function expandTemplate(
  columns: GridTemplateEntry[] | undefined,
  autoColumns: GridTemplateEntry | undefined,
  template: GridTemplateEntry[] | undefined,
  count: number
): GridTemplateEntry[] {
  // Priority: if columns/autoColumns are specified, use those (new API)
  // Otherwise, if template is specified, use it where last value acts as autoColumns
  // Otherwise, default to empty columns with '1*' autoColumns
  
  let explicitColumns: GridTemplateEntry[];
  let autoColumn: GridTemplateEntry;
  
  if (columns !== undefined || autoColumns !== undefined) {
    // New API: explicit columns and/or autoColumns
    explicitColumns = columns ?? [];
    autoColumn = autoColumns ?? '1*';
  } else if (template !== undefined) {
    // Deprecated API: template where last value acts as autoColumns
    explicitColumns = template;
    autoColumn = template.length > 0 ? template[template.length - 1] : '1*';
  } else {
    // No columns specified: default to empty with '1*' autoColumns
    explicitColumns = [];
    autoColumn = '1*';
  }
  
  const expanded: GridTemplateEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (i < explicitColumns.length) {
      expanded.push(explicitColumns[i]);
    } else {
      // Apply the same autoColumn value to all implicitly created columns
      // (CSS Grid's grid-auto-columns is a single value applied to all auto columns)
      expanded.push(autoColumn);
    }
  }
  if (expanded.length === 0) {
    expanded.push('1*');
  }
  return expanded;
}

function calculateColumnWidths(
  tracks: TrackSize[],
  availableWidth: number,
  columnGap: number,
  autoContentWidths: number[]
): number[] {
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
    } else if (track.type === 'auto') {
      const autoWidth = autoContentWidths[i] ?? 0;
      widths[i] = autoWidth;
      fixedTotal += autoWidth;
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
  const rounded = widths.map(w => Math.max(0, Math.floor(w)));

  // Step 5: Clamp total width to available space (minus gaps)
  // CRITICAL: Preserve auto column widths - only adjust flex columns
  const maxContentWidth = Math.max(0, availableWidth - gapSpace);
  let totalRounded = rounded.reduce((sum, w) => sum + w, 0);

  if (totalRounded > maxContentWidth && totalRounded > 0) {
    // Calculate auto/fixed total (these should not be scaled)
    let autoFixedTotal = 0;
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].type === 'auto' || tracks[i].type === 'fixed') {
        autoFixedTotal += rounded[i];
      }
    }
    
    // Only scale flex columns if needed
    const flexTotal = totalRounded - autoFixedTotal;
    if (flexTotal > 0) {
      const availableForFlex = Math.max(0, maxContentWidth - autoFixedTotal);
      const scale = availableForFlex / flexTotal;
      
      let adjustedTotal = autoFixedTotal;
      for (let i = 0; i < rounded.length; i++) {
        if (tracks[i].type === 'flex' || tracks[i].type === 'minmax') {
          rounded[i] = Math.max(0, Math.floor(rounded[i] * scale));
          adjustedTotal += rounded[i];
        }
      }

      let remainder = maxContentWidth - adjustedTotal;
      let idx = 0;
      while (remainder > 0 && rounded.length > 0) {
        const targetIndex = idx % rounded.length;
        // Only add to flex columns
        if (tracks[targetIndex].type === 'flex' || tracks[targetIndex].type === 'minmax') {
          rounded[targetIndex] += 1;
          remainder -= 1;
        }
        idx++;
        if (idx > rounded.length * 10) break; // Safety limit
      }
    } else {
      // No flex columns - scale down fixed and auto columns proportionally if needed
      if (autoFixedTotal > maxContentWidth) {
        const scale = maxContentWidth / autoFixedTotal;
        let adjustedTotal = 0;
        for (let i = 0; i < rounded.length; i++) {
          if (tracks[i].type === 'auto' || tracks[i].type === 'fixed') {
            rounded[i] = Math.max(0, Math.floor(rounded[i] * scale));
            adjustedTotal += rounded[i];
          }
        }
        
        // Distribute remainder to fixed columns (prefer fixed over auto)
        let remainder = maxContentWidth - adjustedTotal;
        let idx = 0;
        while (remainder > 0 && rounded.length > 0) {
          const targetIndex = idx % rounded.length;
          if (tracks[targetIndex].type === 'fixed' || tracks[targetIndex].type === 'auto') {
            rounded[targetIndex] += 1;
            remainder -= 1;
          }
          idx++;
          if (idx > rounded.length * 10) break; // Safety limit
        }
      }
    }
  }

  return rounded;
}

function getRenderedWidth(result: string | string[] | null): number {
  if (result === null) {
    return 0;
  }
  if (Array.isArray(result)) {
    return result.reduce((max, line) => Math.max(max, getTrimmedTextWidth(line)), 0);
  }
  return getTrimmedTextWidth(result);
}

function measureAutoContentWidths(
  tracks: TrackSize[],
  children: Component[],
  ctxFactory: (index: number) => RenderContext
): number[] {
  const widths = new Array(tracks.length).fill(0);
  for (let i = 0; i < tracks.length; i++) {
    if (tracks[i].type !== 'auto') {
      continue;
    }
    const result = children[i] ? callComponent(children[i]!, ctxFactory(i)) : null;
    widths[i] = getRenderedWidth(result);
  }
  return widths;
}

/**
 * Create a grid component (function-based API)
 * This returns a Component that can be used in other grids
 * Accepts Component children, strings (converted to Styled components), or objects with render methods
 */
export function grid(
  options: GridOptions,
  ...children: (Component | string | { render: Component })[]
): Component {
  // Convert children to Components
  const convertedChildren: Component[] = children.map(child => {
    if (typeof child === 'string') {
      // Import Styled dynamically to avoid circular dependency
      const { Styled } = require('../components/styled');
      return Styled({}, child);
    }
    // If it's an object with a render method, extract the render function
    if (typeof child === 'object' && child !== null && 'render' in child && typeof child.render === 'function') {
      return child.render;
    }
    // Otherwise it's already a Component
    return child;
  });
  return (ctx: RenderContext) => {
    const { 
      columns, 
      autoColumns, 
      template, 
      rows,
      autoRows = 1,
      columnGap = 0, 
      rowGap = 0,
      spaceBetween, 
      justify = 'start' 
    } = options;
    
    // Filter out null children (from when conditions)
    const validChildren = convertedChildren.filter(c => c !== null && c !== undefined);
    
    if (validChildren.length === 0) {
      return null;
    }
    
    // Determine number of explicit columns
    const explicitColumns = columns ?? template ?? [];
    const numColumns = explicitColumns.length > 0 ? explicitColumns.length : 1;
    
    // Group children into rows (wrap when exceeding numColumns)
    const rowsData: Component[][] = [];
    for (let i = 0; i < validChildren.length; i += numColumns) {
      rowsData.push(validChildren.slice(i, i + numColumns));
    }
    
    // If we have multiple rows, render them separately and stack vertically
    if (rowsData.length > 1) {
      // Calculate column widths based on the first row (all rows use same column widths for alignment)
      const firstRowChildren = rowsData[0] ?? [];
      const expandedTemplate = expandTemplate(columns, autoColumns, template, firstRowChildren.length);
      const tracks = expandedTemplate.map(parseTemplateEntry);
      
      // Measure content widths for column sizing (use first row as reference)
      const autoContentWidths = measureAutoContentWidths(
        tracks,
        firstRowChildren,
        (index) => createChildContext(ctx, {
          availableWidth: Number.POSITIVE_INFINITY,
          columnIndex: index,
          rowIndex: 0,
        })
      );
      const columnWidths = calculateColumnWidths(
        tracks,
        ctx.availableWidth,
        columnGap,
        autoContentWidths
      );
      
      // Render each row
      const allRowLines: string[] = [];
      for (let rowIdx = 0; rowIdx < rowsData.length; rowIdx++) {
        const rowChildren = rowsData[rowIdx];
        const rowHeight = rows?.[rowIdx] ?? autoRows;
        
        // Render this row's children
        const rowResults: (string | string[] | null)[] = [];
        for (let colIdx = 0; colIdx < rowChildren.length; colIdx++) {
          const child = rowChildren[colIdx];
          const width = columnWidths[colIdx] ?? 0;
          
          const childCtx = createChildContext(ctx, {
            availableWidth: width,
            columnIndex: colIdx,
            rowIndex: rowIdx,
          });
          
          const result = callComponent(child, childCtx);
          rowResults.push(result);
        }
        
        // Build row lines (handle multi-line children)
        const maxRowLines = Math.max(
          ...rowResults.map(r => Array.isArray(r) ? r.length : 1),
          rowHeight
        );
        
        for (let lineIdx = 0; lineIdx < maxRowLines; lineIdx++) {
          const lineParts: string[] = [];
          for (let colIdx = 0; colIdx < rowChildren.length; colIdx++) {
            const result = rowResults[colIdx];
            const columnWidth = columnWidths[colIdx] ?? 0;
            
            let columnContent: string;
            if (result === null) {
              columnContent = ' '.repeat(columnWidth);
            } else if (Array.isArray(result)) {
              columnContent = result[lineIdx] ?? '';
            } else {
              columnContent = lineIdx === 0 ? result : '';
            }
            
            const plainContent = stripAnsi(columnContent);
            const paddedContent = plainContent.length < columnWidth
              ? columnContent + ' '.repeat(columnWidth - plainContent.length)
              : columnContent;
            lineParts.push(paddedContent);
            
            // Add column gap
            if (colIdx < rowChildren.length - 1 && columnGap > 0) {
              lineParts.push(' '.repeat(columnGap));
            }
          }
          
          const line = lineParts.join('');
          const plainLine = stripAnsi(line);
          const paddedLine = plainLine.length < ctx.availableWidth
            ? line + ' '.repeat(ctx.availableWidth - plainLine.length)
            : line;
          allRowLines.push(paddedLine);
        }
        
        // Add row gap (except after last row)
        if (rowIdx < rowsData.length - 1 && rowGap > 0) {
          for (let i = 0; i < rowGap; i++) {
            allRowLines.push(' '.repeat(ctx.availableWidth));
          }
        }
      }
      
      return allRowLines;
    }
    
    // Single row rendering (original logic)
    // Calculate column widths
    const expandedTemplate = expandTemplate(columns, autoColumns, template, validChildren.length);
    const tracks = expandedTemplate.map(parseTemplateEntry);
    const autoContentWidths = measureAutoContentWidths(
      tracks,
      validChildren,
      (index) => createChildContext(ctx, {
        availableWidth: Number.POSITIVE_INFINITY,
        columnIndex: index,
        rowIndex: 0,
      })
    );
    const columnWidths = calculateColumnWidths(
      tracks,
      ctx.availableWidth,
      columnGap,
      autoContentWidths
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
    let anyRenderableChild = false;
    let currentX = startX;
    
    for (let i = 0; i < validChildren.length; i++) {
      const child = validChildren[i];
      const width = actualWidths[i] ?? 0;
      
      // Create context for child
      const childCtx = createChildContext(ctx, {
        availableWidth: width,
        columnIndex: i,
        rowIndex: 0,
      });
      
      // Render child
      const result = callComponent(child, childCtx);
      results.push(result);
      if (result !== null) {
        anyRenderableChild = true;
      }
      
      // Handle gap (spaceBetween or spaces)
      if (i < validChildren.length - 1 && columnGap > 0) {
        if (spaceBetween) {
          const { char: spaceChar, color: spaceColor } = getSpaceBetweenChar(spaceBetween, i);
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
    
    if (!anyRenderableChild) {
      return null;
    }
    
    // Handle multi-line: if any result is string[], expand grid vertically
    const maxLines = Math.max(
      ...results.map(r => Array.isArray(r) ? r.length : 1),
      1
    );
    
    if (maxLines === 1) {
      // Special handling for spaceBetween with auto columns (CSS justify-content: space-between)
      const hasAutoColumns = tracks.some(t => t.type === 'auto');
      const allAuto = tracks.every(t => t.type === 'auto' || t.type === 'flex');
      
      if (spaceBetween && hasAutoColumns && allAuto) {
        // Special case: spaceBetween with auto columns (CSS justify-content: space-between)
        // Collect all auto column contents (skip gap results in results array)
        const autoContents: string[] = [];
        let totalAutoWidth = 0;
        let partIdx = 0;
        
        // Debug: log what we're working with
        if (process.env.DEBUG_GRID) {
          console.log('DEBUG: spaceBetween with auto columns');
          console.log('DEBUG: validChildren.length:', validChildren.length);
          console.log('DEBUG: results.length:', results.length);
          console.log('DEBUG: tracks:', tracks.map(t => t.type));
        }
        
        for (let i = 0; i < validChildren.length; i++) {
          const track = tracks[i];
          
          if (track.type === 'auto') {
            if (process.env.DEBUG_GRID) {
              console.log(`DEBUG: Processing auto column ${i}, partIdx=${partIdx}, results[partIdx]=`, results[partIdx]);
            }
            const result = results[partIdx];
            partIdx++;
            const content = result === null ? '' : (typeof result === 'string' ? result : '');
            const plainContent = stripAnsi(content);
            totalAutoWidth += plainContent.length;
            autoContents.push(content);
            
            if (process.env.DEBUG_GRID) {
              console.log(`DEBUG: Collected auto column ${i}: "${plainContent}", totalAutoWidth=${totalAutoWidth}, autoContents.length=${autoContents.length}`);
            }
            
            // Skip gap result if present (spaceBetween adds gap results between columns)
            // Only skip if this is not the last column and there's a gap result
            if (i < validChildren.length - 1 && columnGap > 0 && partIdx < results.length) {
              if (process.env.DEBUG_GRID) {
                console.log(`DEBUG: Skipping gap result at partIdx=${partIdx}`);
              }
              partIdx++; // Skip the gap result
            }
          } else {
            // Not an auto column, skip it
            partIdx++;
            if (i < validChildren.length - 1 && columnGap > 0 && partIdx < results.length) {
              partIdx++; // Skip gap if present
            }
          }
        }
        
        if (process.env.DEBUG_GRID) {
          console.log('DEBUG: Final autoContents.length:', autoContents.length);
          console.log('DEBUG: Final totalAutoWidth:', totalAutoWidth);
        }
        
        // Calculate spaceBetween fill width
        const spaceBetweenWidth = Math.max(0, ctx.availableWidth - totalAutoWidth);
        const { char: spaceChar, color: spaceColor } = getSpaceBetweenChar(spaceBetween, 0);
        const fillText = spaceChar.repeat(spaceBetweenWidth);
        const spaceBetweenContent = spaceColor ? applyStyle(fillText, { color: spaceColor }) : fillText;
        
        // Build line: first column + spaceBetween + remaining columns
        const lineParts: string[] = [];
        if (autoContents.length > 0) {
          lineParts.push(autoContents[0]);
          if (autoContents.length > 1) {
            lineParts.push(spaceBetweenContent);
            for (let i = 1; i < autoContents.length; i++) {
              lineParts.push(autoContents[i]);
            }
          }
        }
        
        const line = lineParts.join('');
        // Pad to full width to ensure right column is at the end
        const plainLine = stripAnsi(line);
        const paddedLine = plainLine.length < ctx.availableWidth 
          ? line + ' '.repeat(ctx.availableWidth - plainLine.length)
          : line;
        return paddedLine;
      }
      
      // Standard rendering for other cases
      const lineParts: string[] = [];
      let partIdx = 0;
      
      for (let i = 0; i < validChildren.length; i++) {
        const result = results[partIdx];
        partIdx++;
        const columnWidth = actualWidths[i] ?? 0;
        const track = tracks[i];
        const isAuto = track?.type === 'auto';
        
        const isFlex = track?.type === 'flex' || track?.type === 'minmax';
        
        if (result === null) {
          // Null result - pad to column width
          // If spaceBetween is set, use it to fill empty columns (especially flex columns)
          if (!isAuto && spaceBetween && columnWidth > 0) {
            const { char: spaceChar, color: spaceColor } = getSpaceBetweenChar(spaceBetween, i);
            const fillText = spaceChar.repeat(columnWidth);
            lineParts.push(spaceColor ? applyStyle(fillText, { color: spaceColor }) : fillText);
          } else if (!isAuto) {
            lineParts.push(' '.repeat(columnWidth));
          } else {
            lineParts.push('');
          }
        } else {
          const columnContent = typeof result === 'string' ? result : '';
          if (isAuto) {
            lineParts.push(columnContent);
          } else {
            const plainContent = stripAnsi(columnContent);
            let paddedContent: string;
            // If content is empty and this is a flex column with spaceBetween, fill it
            if (plainContent.length === 0 && spaceBetween && columnWidth > 0 && isFlex) {
              const { char: spaceChar, color: spaceColor } = getSpaceBetweenChar(spaceBetween, i);
              const fillText = spaceChar.repeat(columnWidth);
              paddedContent = spaceColor ? applyStyle(fillText, { color: spaceColor }) : fillText;
            } else if (plainContent.length === 0 && spaceBetween && columnWidth > 0) {
              const { char: spaceChar, color: spaceColor } = getSpaceBetweenChar(spaceBetween, i);
              const fillText = spaceChar.repeat(columnWidth);
              paddedContent = spaceColor ? applyStyle(fillText, { color: spaceColor }) : fillText;
            } else {
              paddedContent = plainContent.length < columnWidth
                ? columnContent + ' '.repeat(columnWidth - plainContent.length)
                : columnContent;
            }
            lineParts.push(paddedContent);
        }
        }
        
        // Skip gap result if present (gap results are added to results array between columns)
        // Then add gap to lineParts if not using spaceBetween
        if (i < validChildren.length - 1 && columnGap > 0) {
          // Skip the gap result in the results array
          if (partIdx < results.length) {
            partIdx++; // Skip the gap result
          }
          // Add gap to line (unless spaceBetween is set, which handles gaps differently)
          if (!spaceBetween) {
            lineParts.push(' '.repeat(columnGap));
          }
        }
      }
      
      const line = lineParts.join('');
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
        const columnWidth = actualWidths[i] ?? 0;
        const track = tracks[i];
        const isAuto = track?.type === 'auto';
        const isFlex = track?.type === 'flex' || track?.type === 'minmax';
        
        if (result === null) {
          // Null result - pad to column width
          // If spaceBetween is set, use it to fill empty columns (especially flex columns)
          if (!isAuto && spaceBetween && columnWidth > 0) {
            const { char: spaceChar, color: spaceColor } = getSpaceBetweenChar(spaceBetween, i);
            const fillText = spaceChar.repeat(columnWidth);
            lineParts.push(spaceColor ? applyStyle(fillText, { color: spaceColor }) : fillText);
          } else if (!isAuto) {
            lineParts.push(' '.repeat(columnWidth));
          } else {
            lineParts.push('');
          }
          // Skip gap result if present
          if (i < validChildren.length - 1 && columnGap > 0 && partIdx < results.length) {
            partIdx++;
          }
          continue;
        }
        
        let columnContent: string;
        if (Array.isArray(result)) {
          columnContent = result[lineIdx] ?? '';
        } else {
          columnContent = lineIdx === 0 ? result : '';
        }
        
        // CRITICAL: Pad each column to its allocated width
        // This ensures flex columns actually fill their allocated space
        // If spaceBetween is set and content is empty, fill with spaceBetween character
        if (isAuto) {
          lineParts.push(columnContent);
        } else {
          const plainContent = columnContent.replace(/\x1b\[[0-9;]*m/g, '');
          let paddedContent: string;
          // If content is empty and this is a flex column with spaceBetween, fill it
          if (plainContent.length === 0 && spaceBetween && columnWidth > 0 && isFlex) {
            const { char: spaceChar, color: spaceColor } = getSpaceBetweenChar(spaceBetween, i);
            const fillText = spaceChar.repeat(columnWidth);
            paddedContent = spaceColor ? applyStyle(fillText, { color: spaceColor }) : fillText;
          } else if (plainContent.length === 0 && spaceBetween && columnWidth > 0) {
            const { char: spaceChar, color: spaceColor } = getSpaceBetweenChar(spaceBetween, i);
            const fillText = spaceChar.repeat(columnWidth);
            paddedContent = spaceColor ? applyStyle(fillText, { color: spaceColor }) : fillText;
          } else {
            paddedContent = plainContent.length < columnWidth
              ? columnContent + ' '.repeat(columnWidth - plainContent.length)
              : columnContent;
          }
          lineParts.push(paddedContent);
        }
        
        // Skip gap result if present (gap results are added to results array between columns)
        // Then add gap to lineParts if not using spaceBetween
        if (i < validChildren.length - 1 && columnGap > 0) {
          // Skip the gap result in the results array
          if (partIdx < results.length) {
            partIdx++; // Skip the gap result
          }
          // Add gap to line (unless spaceBetween is set, which handles gaps differently)
          if (!spaceBetween) {
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

