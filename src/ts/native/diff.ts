// Diffing algorithm for efficient updates - TypeScript implementation
// Optimized for Node.js performance

export type DiffOp =
  | { type: 'no_change' }
  | { type: 'update_line'; line: number; content: string }
  | { type: 'delete_line'; line: number }
  | { type: 'insert_line'; line: number; content: string };

/**
 * Diff two frames to generate minimal update operations.
 * This minimizes the number of writes to stdout by only updating changed lines.
 */
export function diffFrames(prev: string[], curr: string[]): DiffOp[] {
  const ops: DiffOp[] = [];
  const maxLen = Math.max(prev.length, curr.length);

  for (let i = 0; i < maxLen; i++) {
    const prevLine = i < prev.length ? prev[i] : null;
    const currLine = i < curr.length ? curr[i] : null;

    if (prevLine === null && currLine !== null) {
      // Line inserted
      ops.push({ type: 'insert_line', line: i, content: currLine });
    } else if (prevLine !== null && currLine === null) {
      // Line deleted
      ops.push({ type: 'delete_line', line: i });
    } else if (prevLine !== null && currLine !== null) {
      // Check if line changed (use strict equality for fast comparison)
      if (prevLine !== currLine) {
        ops.push({ type: 'update_line', line: i, content: currLine });
      } else {
        ops.push({ type: 'no_change' });
      }
    }
  }

  return ops;
}

