// Diffing algorithm for efficient updates - TypeScript implementation
// Optimized for Node.js performance

export type DiffOp =
  | { type: 'no_change' }
  | { type: 'update_line'; line: number; content: string }
  | { type: 'delete_line'; line: number }
  | { type: 'insert_line'; line: number; content: string };


/**
 * Diff two frames to generate minimal update operations.
 * 
 * Strategy:
 * - If only a small continuous region of a line changes, use partial update
 * - If multiple regions change or changes are scattered, redraw the whole line
 * - When lines are deleted, all lines below need to be redrawn (reflow)
 */
export function diffFrames(prev: string[], curr: string[]): DiffOp[] {
  const ops: DiffOp[] = [];
  const maxLen = Math.max(prev.length, curr.length);
  let needsReflow = false; // Track if we need to redraw lines below

  for (let i = 0; i < maxLen; i++) {
    const prevLine = i < prev.length ? prev[i] : null;
    const currLine = i < curr.length ? curr[i] : null;

    if (prevLine === null && currLine !== null) {
      // Line inserted - causes reflow
      needsReflow = true;
      ops.push({ type: 'insert_line', line: i, content: currLine });
    } else if (prevLine !== null && currLine === null) {
      // Line deleted - causes reflow of everything below
      needsReflow = true;
      ops.push({ type: 'delete_line', line: i });
    } else if (prevLine !== null && currLine !== null) {
      if (prevLine === currLine) {
        // No change, but if we had reflow above, we need to redraw
        if (needsReflow) {
          ops.push({ type: 'update_line', line: i, content: currLine });
        } else {
          ops.push({ type: 'no_change' });
        }
      } else {
        // Line changed
        // For now, we always redraw the whole line for simplicity
        // Partial updates with ANSI codes are complex and error-prone
        // The optimization would be: if change is small and continuous, update just that region
        // But preserving ANSI codes at boundaries is tricky, so we redraw for correctness
        needsReflow = true; // Any line change causes reflow below
        ops.push({ type: 'update_line', line: i, content: currLine });
      }
    }
  }

  return ops;
}

