// Test the capturable terminal itself
import { describe, it, expect, beforeEach } from 'vitest';
import { CapturableTerminal } from './capturable-terminal.js';
import { Col } from '../components/col.js';
import { Flex } from '../layout/flex.js';
import type { TerminalRegion } from '../region.js';

describe('CapturableTerminal', () => {
  it('should capture setLine calls', () => {
    const terminal = new CapturableTerminal(80, 24);
    
    terminal.setLine(1, 'Hello');
    terminal.setLine(2, 'World');
    
    expect(terminal.getLine(1)).toBe('Hello');
    expect(terminal.getLine(2)).toBe('World');
    expect(terminal.getSetLineCalls()).toHaveLength(2);
  });

  it('should detect when columns overwrite each other', () => {
    const terminal = new CapturableTerminal(80, 24);
    
    // Simulate two columns writing to the same line
    // This is the bug: second write overwrites first
    terminal.setLine(1, 'Column1'.padEnd(40, ' '));
    terminal.setLine(1, 'Column2'.padEnd(40, ' '));
    
    // With the bug, only Column2 is visible
    const finalLine = terminal.getLine(1);
    expect(finalLine).toContain('Column2');
    expect(finalLine).not.toContain('Column1'); // This is the bug!
    
    // We should see both columns, but we don't
    // This test documents the bug we're trying to fix
  });

  it('should verify flex layout renders columns side-by-side', () => {
    const capturable = new CapturableTerminal(80, 24);
    const terminal = capturable as unknown as TerminalRegion;
    
    const flex = new Flex(terminal, { gap: 2 });
    const col1 = new Col(terminal, 'Label', { min: 12, max: 12 });
    const col2 = new Col(terminal, 'Value', { flex: 1 });
    
    flex.addChild(col1);
    flex.addChild(col2);
    
    flex.render(0, 1, 80);
    
    // Check that both columns appear on the same line
    const line1 = capturable.getLine(1);
    const line1Plain = line1.replace(/\x1b\[[0-9;]*m/g, '');
    
    // With the fix, we should see both "Label" and "Value" on the same line
    expect(line1Plain).toContain('Label');
    expect(line1Plain).toContain('Value');
  });
});

