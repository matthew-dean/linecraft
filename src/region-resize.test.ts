// Unit tests for resize/reflow bug reproduction

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TerminalRegion } from './region.js';
import { Styled } from './components/styled.js';

describe('Region resize and reflow', () => {
  let mockStdout: NodeJS.WriteStream;
  let writtenData: string[];

  beforeEach(() => {
    writtenData = [];
    mockStdout = {
      isTTY: true,
      columns: 80,
      rows: 24,
      write: (chunk: string) => {
        writtenData.push(chunk);
        return true;
      },
      on: () => {},
      off: () => {},
      removeListener: () => {},
    } as any;
  });

  afterEach(() => {
    writtenData = [];
  });

  it('should re-render static lines (like prompt) after resize', () => {
    const region = new TerminalRegion({
      stdout: mockStdout,
      disableRendering: false,
    });

    // Add a component that will wrap differently on resize
    const longText = 'This is a very long line that will wrap when the terminal is narrow but not when it is wide';
    region.set(Styled({}, longText));
    
    // Add a prompt (static lines)
    const promptSection = region.add(['', 'Press SPACEBAR to continue...']);
    
    // Simulate initial render at narrow width
    (mockStdout as any).columns = 40; // Narrow terminal
    const renderer = (region as any).renderer;
    renderer.viewportWidth = 40;
    renderer.width = 40;
    renderer.effectiveWidth = 40;
    
    // Trigger re-render
    (region as any).reRenderLastContent();
    renderer.flush();
    
    // Verify prompt was rendered
    const initialOutput = writtenData.join('');
    expect(initialOutput).toContain('Press SPACEBAR');
    
    // Clear written data
    writtenData = [];
    
    // Simulate resize to wider terminal
    (mockStdout as any).columns = 120; // Wide terminal
    renderer.viewportWidth = 120;
    renderer.width = 120;
    renderer.effectiveWidth = 120;
    
    // Trigger re-render after resize
    (region as any).reRenderLastContent();
    renderer.flush();
    
    // Verify prompt is still rendered after resize
    const afterResizeOutput = writtenData.join('');
    expect(afterResizeOutput).toContain('Press SPACEBAR');
  });

  it('should properly reflow content when lines are deleted', () => {
    const region = new TerminalRegion({
      stdout: mockStdout,
      disableRendering: false,
    });

    // Add component that takes multiple lines when narrow
    const component = Styled({}, 'Line 1\nLine 2\nLine 3\nLine 4');
    region.set(component);
    
    // Add prompt below
    const promptSection = region.add(['', 'Press SPACEBAR to continue...']);
    
    // Simulate narrow terminal (content wraps to 4 lines)
    (mockStdout as any).columns = 20;
    const renderer = (region as any).renderer;
    renderer.viewportWidth = 20;
    renderer.width = 20;
    renderer.effectiveWidth = 20;
    
    (region as any).reRenderLastContent();
    renderer.flush();
    
    const initialOutput = writtenData.join('');
    expect(initialOutput).toContain('Press SPACEBAR');
    
    // Clear
    writtenData = [];
    
    // Simulate wide terminal (content fits in 1 line, so 3 lines are "deleted")
    (mockStdout as any).columns = 120;
    renderer.viewportWidth = 120;
    renderer.width = 120;
    renderer.effectiveWidth = 120;
    
    // This should reflow and redraw the prompt
    (region as any).reRenderLastContent();
    renderer.flush();
    
    // Prompt should still be visible (reflowed down)
    const afterResizeOutput = writtenData.join('');
    expect(afterResizeOutput).toContain('Press SPACEBAR');
  });

  it('should not duplicate content when resizing', () => {
    const region = new TerminalRegion({
      stdout: mockStdout,
      disableRendering: false,
    });

    region.set(Styled({}, 'Test content'));
    region.add(['', 'Press SPACEBAR to continue...']);
    
    (mockStdout as any).columns = 40;
    const renderer = (region as any).renderer;
    renderer.viewportWidth = 40;
    renderer.width = 40;
    renderer.effectiveWidth = 40;
    
    (region as any).reRenderLastContent();
    renderer.flush();
    
    const count1 = (writtenData.join('').match(/Press SPACEBAR/g) || []).length;
    writtenData = [];
    
    // Resize
    (mockStdout as any).columns = 120;
    renderer.viewportWidth = 120;
    renderer.width = 120;
    renderer.effectiveWidth = 120;
    
    (region as any).reRenderLastContent();
    renderer.flush();
    
    const count2 = (writtenData.join('').match(/Press SPACEBAR/g) || []).length;
    // Should appear exactly once, not duplicated
    expect(count2).toBeLessThanOrEqual(1);
  });
});

