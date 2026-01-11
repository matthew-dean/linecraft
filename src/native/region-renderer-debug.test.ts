// Debug test to understand viewport frame calculation during resize

import { describe, it, expect } from 'vitest';
import { RegionRenderer } from './region-renderer.js';

describe('Viewport frame calculation during resize', () => {
  it('should show correct lines when content height changes', () => {
    const mockStdout = {
      isTTY: true,
      columns: 80,
      rows: 24,
      write: () => true,
      on: () => {},
      off: () => {},
      removeListener: () => {},
    } as any;

    const renderer = new RegionRenderer({
      stdout: mockStdout,
      disableRendering: true,
    });

    // Set initial content (10 lines)
    const initialContent = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`);
    renderer.pendingFrame = [...initialContent];
    renderer.height = 10;
    (renderer as any).previousFrame = [...initialContent];

    // Simulate viewport showing bottom 5 lines (lines 6-10)
    (renderer as any).viewportHeight = 5;
    const frame1 = (renderer as any).buildViewportFrame();
    expect(frame1.length).toBe(5);
    expect(frame1[0]).toBe('Line 6');
    expect(frame1[4]).toBe('Line 10');

    // Now content wraps to 15 lines (more lines)
    const newContent = Array.from({ length: 15 }, (_, i) => `Line ${i + 1} (wrapped)`);
    renderer.pendingFrame = [...newContent];
    renderer.height = 15;

    // Viewport frame should show bottom 5 lines (lines 11-15)
    const frame2 = (renderer as any).buildViewportFrame();
    expect(frame2.length).toBe(5);
    expect(frame2[0]).toBe('Line 11 (wrapped)');
    expect(frame2[4]).toBe('Line 15 (wrapped)');

    // The issue: previousViewportFrame has old content at old positions
    // But new frame has new content at new positions
    // Diff will compare frame1[0] ('Line 6') with frame2[0] ('Line 11 (wrapped)')
    // This looks like a transposition, but it's actually just the viewport shifting
  });
});

