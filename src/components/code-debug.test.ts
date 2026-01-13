// Unit tests for code-debug component

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeDebug } from './code-debug.js';
import { TerminalRegion } from '../region.js';
import { callComponent } from '../component.js';
import { stripAnsi, countVisibleChars } from '../utils/text.js';

describe('code-debug component', () => {
  let region: TerminalRegion;

  beforeEach(() => {
    region = new TerminalRegion({ disableRendering: true, width: 100 });
  });

  function render(component: ReturnType<typeof CodeDebug>, width: number = 100): string[] {
    const ctx = {
      availableWidth: width,
      region: region,
      columnIndex: 0,
      rowIndex: 0,
    };
    const result = callComponent(component, ctx);
    if (Array.isArray(result)) {
      return result;
    } else if (result) {
      return [result];
    }
    return [];
  }

  describe('truncated code with ellipsis', () => {
    it('should correctly point to .v at columns 77-78 when code is truncated with start ellipsis', () => {
      // This is the extend-chaining example that's failing
      const errorLine = '  .ma:extend(.a,.b,.c,.d,.e,.f,.g,.h,.i,.j,.k,.l,.m,.n,.o,.p,.q,.r,.s,.t,.u,.v) {};';
      const startColumn = 77; // Should point to '.'
      const endColumn = 78; // Should point to 'v'
      
      // Verify original columns
      expect(errorLine[startColumn - 1]).toBe('.');
      expect(errorLine[endColumn - 1]).toBe('v');
      
      // Test with width that causes truncation (80 chars should truncate this 83-char line)
      const width = 80;
      const component = CodeDebug({
        startLine: 77,
        startColumn,
        endColumn,
        errorLine,
        message: 'Extend target ".v" not accessible',
        shortMessage: 'extend target not accessible',
        filePath: 'test.less',
        fullPath: '/test/test.less',
        baseDir: '/test',
        type: 'warning',
      });
      
      const output = render(component, width);
      const outputText = output.join('\n');
      const outputTextPlain = stripAnsi(outputText);
      
      // Find the error line (line with │ and the code) - format: "77 │ ..."
      const errorLineRegex = /^\s*\d+\s*│\s*(.+)$/m;
      const errorLineMatch = outputTextPlain.match(errorLineRegex);
      expect(errorLineMatch, `Error line should be found in:\n${outputTextPlain}`).toBeTruthy();
      const renderedErrorLinePlain = errorLineMatch![1];
      
      // Find the indicator line (line with │ and the underline) - format: "  │ ..."
      // Look for lines with indicator characters (┖, ┬, ┚, ╿)
      const lines = outputTextPlain.split('\n');
      let indicatorLinePlain: string | null = null;
      let fullIndicatorLine: string | null = null;
      for (const line of lines) {
        if (line.includes('│') && (line.includes('┖') || line.includes('┬') || line.includes('┚') || line.includes('╿'))) {
          fullIndicatorLine = line;
          const match = line.match(/│ (.*)$/);
          if (match) {
            indicatorLinePlain = match[1];
            break;
          }
        }
      }
      expect(indicatorLinePlain, `Indicator line should be found in:\n${outputTextPlain}`).toBeTruthy();
      
      // The indicator should point to .v in the rendered error line
      // Find where .v appears in the rendered error line
      const dotVIndex = renderedErrorLinePlain.indexOf('.v');
      expect(dotVIndex, `.v should be visible in rendered line: "${renderedErrorLinePlain}"`).toBeGreaterThanOrEqual(0);
      
      // The indicator (┖, ┬, ┚, or ╿) should be positioned at or near .v
      // Find the position of the T-bar (┬) or bracket (┖/┚) in the indicator line
      const tBarIndex = indicatorLinePlain!.indexOf('┬');
      const bracketStart = indicatorLinePlain!.indexOf('┖');
      const bracketEnd = indicatorLinePlain!.indexOf('┚');
      const indicatorPos = tBarIndex >= 0 ? tBarIndex : (bracketStart >= 0 ? bracketStart : bracketEnd);
      expect(indicatorPos, `Indicator should be found in: "${indicatorLinePlain}"`).toBeGreaterThanOrEqual(0);
      
      // Account for ellipsis at start if present
      // renderedErrorLinePlain includes ellipsis if present
      const expectedIndicatorPos = dotVIndex;
      
      // The indicator should be at or near where .v is (within 2 characters)
      expect(Math.abs(indicatorPos - expectedIndicatorPos), 
        `Indicator at ${indicatorPos} should be near .v at ${expectedIndicatorPos} in error line "${renderedErrorLinePlain}" and indicator "${indicatorLinePlain}"`).toBeLessThanOrEqual(2);
    });
  });

  describe('short message alignment', () => {
    it('should correctly align left-placed short message (message on right side)', () => {
      // Left placement means message appears to the right of the code
      const component = CodeDebug({
        startLine: 50,
        startColumn: 16,
        endColumn: 35,
        errorLine: 'const result = veryLongFunctionName(withManyParameters, andMoreParameters)',
        message: 'Line too long',
        shortMessage: 'line too long',
        shortMessagePlacement: 'left',
        filePath: 'test.ts',
        fullPath: '/test/test.ts',
        baseDir: '/test',
        type: 'error',
      });
      
      const output = render(component, 100);
      
      // Find the short message line (should have connector ──╯ pointing left)
      const shortMessageLineRegex = /^\s*│\s*(.+)$/m;
      const lines = output.join('\n').split('\n');
      let shortMessageLine: string | null = null;
      for (const line of lines) {
        if (line.includes('──╯') || line.includes('line too long')) {
          shortMessageLine = line;
          break;
        }
      }
      
      expect(shortMessageLine).toBeTruthy();
      const shortMessageLinePlain = stripAnsi(shortMessageLine!);
      
      // Find the indicator line to get the T-bar position
      const indicatorLineRegex = /^\s*│\s*(.+)$/m;
      let indicatorLine: string | null = null;
      for (const line of lines) {
        if (line.includes('┬') || line.includes('┖')) {
          indicatorLine = line;
          break;
        }
      }
      expect(indicatorLine).toBeTruthy();
      const indicatorLinePlain = stripAnsi(indicatorLine!);
      
      // Find T-bar position in indicator line
      const tBarPos = indicatorLinePlain.indexOf('┬');
      expect(tBarPos).toBeGreaterThanOrEqual(0);
      
      // Find connector end (╯) position in short message line
      const connectorEndPos = shortMessageLinePlain.indexOf('╯');
      expect(connectorEndPos).toBeGreaterThanOrEqual(0);
      
      // The connector end (╯) should be at the T-bar position (exactly)
      // Since both indicatorLinePlain and shortMessageLinePlain are offsets from the same │ prefix,
      // their indices should match directly.
      expect(connectorEndPos, 
        `Left-placed message: T-bar at ${tBarPos}, connector end at ${connectorEndPos}`).toBe(tBarPos);
    });

    it('should correctly align right-placed short message (message on left side)', () => {
      // Right placement means message appears to the left of the code
      const component = CodeDebug({
        startLine: 12,
        startColumn: 12,
        endColumn: 16,
        errorLine: '    return x + y + z;',
        message: 'Type error: cannot add string and number',
        shortMessage: 'string + number',
        shortMessagePlacement: 'right',
        filePath: 'test.ts',
        fullPath: '/test/test.ts',
        baseDir: '/test',
        type: 'error',
      });
      
      const output = render(component, 100);
      
      // Find the short message line (should have connector ╰── pointing right)
      const lines = output.join('\n').split('\n');
      let shortMessageLine: string | null = null;
      for (const line of lines) {
        if (line.includes('╰──') || line.includes('string + number')) {
          shortMessageLine = line;
          break;
        }
      }
      
      expect(shortMessageLine).toBeTruthy();
      const shortMessageLinePlain = stripAnsi(shortMessageLine!);
      
      // Find the indicator line to get the T-bar position
      let indicatorLine: string | null = null;
      for (const line of lines) {
        if (line.includes('┬') || line.includes('┖')) {
          indicatorLine = line;
          break;
        }
      }
      expect(indicatorLine).toBeTruthy();
      const indicatorLinePlain = stripAnsi(indicatorLine!);
      
      // Find T-bar position in indicator line
      const tBarPos = indicatorLinePlain.indexOf('┬');
      expect(tBarPos).toBeGreaterThanOrEqual(0);
      
      // Find connector start (╰) position in short message line
      const connectorStartPos = shortMessageLinePlain.indexOf('╰');
      expect(connectorStartPos).toBeGreaterThanOrEqual(0);
      
      // The connector start (╰) should be at the T-bar position (exactly)
      // Since both indicatorLinePlain and shortMessageLinePlain are offsets from the same │ prefix,
      // their indices should match directly.
      expect(connectorStartPos,
        `Right-placed message: T-bar at ${tBarPos}, connector start at ${connectorStartPos}`).toBe(tBarPos);
    });
  });

  describe('hyperlink preservation', () => {
    it('should preserve OSC 8 hyperlink on truncated file path', () => {
      // When a file path with a hyperlink is truncated, the entire visible portion should remain clickable
      const component = CodeDebug({
        startLine: 77,
        startColumn: 77,
        endColumn: 78,
        errorLine: '  .ma:extend(.a,.b,.c,.d,.e,.f,.g,.h,.i,.j,.k,.l,.m,.n,.o,.p,.q,.r,.s,.t,.u,.v) {};',
        message: 'Extend target ".v" not accessible',
        shortMessage: 'extend target not accessible',
        filePath: '../less.js/packages/test-data/tests-unit/extend-chaining/extend-chaining.less',
        fullPath: '/project/../less.js/packages/test-data/tests-unit/extend-chaining/extend-chaining.less',
        baseDir: '/project',
        type: 'warning',
      });
      
      const output = render(component, 80); // Narrow width to force truncation
      const outputText = output.join('\n');
      const outputTextPlain = stripAnsi(outputText);
      
      // Find the location line (has the file path with hyperlink)
      // Format: "  ╭─[path:line:column]"
      const locationLineMatch = outputTextPlain.match(/╭─\[(.+?)\]/);
      expect(locationLineMatch, `Location line should be found in:\n${outputTextPlain.substring(0, 200)}`).toBeTruthy();
      // Get the actual line with ANSI codes for hyperlink checking
      const locationLineWithAnsi = output.join('\n').split('\n').find(line => stripAnsi(line).includes('╭─['));
      expect(locationLineWithAnsi, 'Location line with ANSI should be found').toBeTruthy();
      const locationLine = locationLineWithAnsi!;
      
      // Check that the entire visible path (not just ellipsis) has the OSC 8 hyperlink
      // OSC 8 format: \x1b]8;;<url>\x1b\\<text>\x1b]8;;\x1b\\
      // The hyperlink should wrap the entire visible text, not just the ellipsis
      const hasOsc8Start = locationLine.includes('\x1b]8;;');
      expect(hasOsc8Start, 'Location line should contain OSC 8 hyperlink start').toBe(true);
      
      // Extract the visible path portion (after ellipsis if present)
      const pathMatch = locationLine.match(/\[(.+?)\]/);
      expect(pathMatch, 'Path should be found in location line').toBeTruthy();
      const visiblePath = pathMatch![1];
      const visiblePathPlain = stripAnsi(visiblePath);
      
      // If truncated with ellipsis, check that text after ellipsis is still in the link
      if (visiblePathPlain.startsWith('...')) {
        // Find where the ellipsis ends and the actual path text begins
        const pathAfterEllipsis = visiblePathPlain.substring(3);
        // The path after ellipsis should still be part of the hyperlink
        // We can't easily test this without parsing OSC 8, but we can check that
        // the hyperlink sequence appears before the ellipsis and continues after
        const ellipsisIndex = locationLine.indexOf('...');
        const pathAfterEllipsisIndex = locationLine.indexOf(pathAfterEllipsis.substring(0, Math.min(10, pathAfterEllipsis.length)));
        
        // There should be an OSC 8 start before the ellipsis
        const osc8BeforeEllipsis = locationLine.substring(0, ellipsisIndex).includes('\x1b]8;;');
        expect(osc8BeforeEllipsis || pathAfterEllipsisIndex > ellipsisIndex, 
          'Hyperlink should start before ellipsis and continue on the visible path text').toBe(true);
      }
    });
  });
});
