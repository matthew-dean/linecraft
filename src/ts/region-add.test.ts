import { describe, it, expect, beforeEach } from 'vitest';
import { TerminalRegion } from './region';
import { flex, col, resolveFlexTree } from './api/flex';

describe('TerminalRegion.add() - Progressive Appending', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    region = new TerminalRegion({ disableRendering: true });
  });

  it('should append multiple sections progressively', () => {
    // Section 1: Title + Content + Visual (3 lines)
    const title1 = flex({ gap: 0 }, col({ width: 25, color: 'brightBlack' }, 'Section 1:'));
    const content1 = flex({ gap: 0 }, 
      col({ width: 25, color: 'brightBlack' }, ''),
      col({ width: 20, color: 'cyan' }, 'Content 1')
    );
    const visual1 = flex({ gap: 0 },
      col({ width: 25, color: 'brightBlack' }, ''),
      col({ width: 20, bg: '█', color: 'cyan' }, ' 20')
    );

    // Set first section
    region.set(title1, content1, visual1);
    expect(region.height).toBe(3);

    // Section 2: Title + Content + Visual (3 lines)
    const title2 = flex({ gap: 0 }, col({ width: 25, color: 'brightBlack' }, 'Section 2:'));
    const content2 = flex({ gap: 0 },
      col({ width: 25, color: 'brightBlack' }, ''),
      col({ width: 20, color: 'green' }, 'Content 2')
    );
    const visual2 = flex({ gap: 0 },
      col({ width: 25, color: 'brightBlack' }, ''),
      col({ width: 20, bg: '█', color: 'green' }, ' 20')
    );

    // Add second section
    // Debug: Check heights before add
    const title2Component = resolveFlexTree(region, title2);
    const content2Component = resolveFlexTree(region, content2);
    const visual2Component = resolveFlexTree(region, visual2);
    console.log('Before add - height:', region.height);
    console.log('Title2 height:', title2Component.getHeight());
    console.log('Content2 height:', content2Component.getHeight());
    console.log('Visual2 height:', visual2Component.getHeight());
    console.log('Total expected height:', title2Component.getHeight() + content2Component.getHeight() + visual2Component.getHeight());
    
    region.add(title2, content2, visual2);
    
    // Debug: Check what's in allComponentDescriptors
    const descriptors = (region as any).allComponentDescriptors;
    console.log('After add section 2, descriptors count:', descriptors.length);
    console.log('After add section 2, height:', region.height);
    expect(region.height).toBe(6); // Should be 3 + 3

    // Section 3: Title + Content + Visual (3 lines)
    const title3 = flex({ gap: 0 }, col({ width: 25, color: 'brightBlack' }, 'Section 3:'));
    const content3 = flex({ gap: 0 },
      col({ width: 25, color: 'brightBlack' }, ''),
      col({ width: 20, color: 'yellow' }, 'Content 3')
    );
    const visual3 = flex({ gap: 0 },
      col({ width: 25, color: 'brightBlack' }, ''),
      col({ width: 20, bg: '█', color: 'yellow' }, ' 20')
    );

    // Add third section
    region.add(title3, content3, visual3);
    expect(region.height).toBe(9); // Should be 3 + 3 + 3

    // Flush to render
    region.flush();

    // Verify all sections are present
    const nativeRegion = region as any;
    const pendingFrame = nativeRegion.region.pendingFrame;

    // Check that we have 9 lines
    expect(pendingFrame.length).toBeGreaterThanOrEqual(9);

    // Verify content is unique (not all the same)
    const line1 = pendingFrame[0] || '';
    const line4 = pendingFrame[3] || '';
    const line7 = pendingFrame[6] || '';

    // Each section should have different content
    expect(line1).toContain('Section 1');
    expect(line4).toContain('Section 2');
    expect(line7).toContain('Section 3');

    // Verify content lines are different
    const line2 = pendingFrame[1] || '';
    const line5 = pendingFrame[4] || '';
    const line8 = pendingFrame[7] || '';

    expect(line2).toContain('Content 1');
    expect(line5).toContain('Content 2');
    expect(line8).toContain('Content 3');
  });

  it('should preserve all content when reRenderLastContent is called', () => {
    // Add multiple sections
    const title1 = flex({ gap: 0 }, col({ width: 25, color: 'brightBlack' }, 'Test 1:'));
    const content1 = flex({ gap: 0 },
      col({ width: 25, color: 'brightBlack' }, ''),
      col({ width: 20, color: 'red' }, 'Red content')
    );
    region.set(title1, content1);
    expect(region.height).toBe(2);

    const title2 = flex({ gap: 0 }, col({ width: 25, color: 'brightBlack' }, 'Test 2:'));
    const content2 = flex({ gap: 0 },
      col({ width: 25, color: 'brightBlack' }, ''),
      col({ width: 20, color: 'blue' }, 'Blue content')
    );
    region.add(title2, content2);
    expect(region.height).toBe(4);

    // Flush initial render
    region.flush();

    // Simulate reRenderLastContent (like keep-alive or resize)
    const reRenderMethod = (region as any).reRenderLastContent.bind(region);
    reRenderMethod();

    // Verify all content is still present
    const nativeRegion = region as any;
    const pendingFrame = nativeRegion.region.pendingFrame;

    expect(pendingFrame.length).toBeGreaterThanOrEqual(4);

    const line1 = pendingFrame[0] || '';
    const line3 = pendingFrame[2] || '';

    // Both sections should still be present
    expect(line1).toContain('Test 1');
    expect(line3).toContain('Test 2');
  });

  it('should handle ellipsis example correctly', () => {
    // Simulate the ellipsis example from flex-all-features
    const ellipsisContent = flex({ gap: 1 },
      col({ width: 20, overflow: 'ellipsis-end', color: 'cyan' }, 'Ellipsis at end of long text'),
      col({ width: 20, overflow: 'ellipsis-start', color: 'green' }, 'Ellipsis at start of long text'),
      col({ width: 20, overflow: 'ellipsis-middle', color: 'yellow' }, 'Ellipsis in middle of long text')
    );
    const ellipsisVisual = flex({ gap: 1 },
      col({ width: 20, bg: '█', color: 'cyan' }, ' 20'),
      col({ width: 20, bg: '█', color: 'green' }, ' 20'),
      col({ width: 20, bg: '█', color: 'yellow' }, ' 20')
    );

    const title = flex({ gap: 0 }, col({ width: 25, color: 'brightBlack' }, 'Ellipsis Types:'));
    const contentLine = flex({ gap: 0 },
      col({ width: 25, color: 'brightBlack' }, ''),
      ellipsisContent
    );
    const visualLine = flex({ gap: 0 },
      col({ width: 25, color: 'brightBlack' }, ''),
      ellipsisVisual
    );

    region.set(title, contentLine, visualLine);
    expect(region.height).toBe(3);

    region.flush();

    // Verify content is rendered
    const nativeRegion = region as any;
    const pendingFrame = nativeRegion.region.pendingFrame;

    expect(pendingFrame.length).toBeGreaterThanOrEqual(3);
    
    // Title line should have "Ellipsis Types"
    const titleLine = pendingFrame[0] || '';
    expect(titleLine).toContain('Ellipsis Types');

    // Content line should have text (may be truncated)
    const contentLineText = pendingFrame[1] || '';
    expect(contentLineText.length).toBeGreaterThan(0);

    // Visual line should have blocks
    const visualLineText = pendingFrame[2] || '';
    expect(visualLineText.length).toBeGreaterThan(0);
  });
});

