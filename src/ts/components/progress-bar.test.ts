import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { ProgressBar } from './progress-bar';
import { TerminalRegion } from '../region';

// Mock the region
const createMockRegion = () => {
  const setLineMock = vi.fn();
  const mockRegion = {
    setLine: setLineMock,
  } as unknown as TerminalRegion;
  return { region: mockRegion, setLineMock };
};

describe('ProgressBar', () => {
  let region: TerminalRegion;
  let setLineMock: MockedFunction<(lineNumber: number, content: string | { text: string; style?: any }) => void>;
  let progressBar: ProgressBar;

  beforeEach(() => {
    const mock = createMockRegion();
    region = mock.region;
    setLineMock = mock.setLineMock;
  });

  describe('constructor', () => {
    it('should create a progress bar with default options', () => {
      progressBar = new ProgressBar(region, 1);
      expect(progressBar).toBeDefined();
    });

    it('should create a progress bar with custom options', () => {
      progressBar = new ProgressBar(region, 2, {
        label: 'Loading',
        width: 50,
        style: {
          complete: '=',
          incomplete: '-',
          brackets: ['<', '>'],
        },
      });
      expect(progressBar).toBeDefined();
    });

    it('should use default values for missing options', () => {
      progressBar = new ProgressBar(region, 1, { label: 'Test' });
      expect(progressBar).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update progress and render', () => {
      progressBar = new ProgressBar(region, 1, { label: 'Test', width: 20 });
      progressBar.update(50, 100);
      
      expect(setLineMock).toHaveBeenCalled();
      const call = setLineMock.mock.calls[0];
      expect(call[0]).toBe(1);
      const content = typeof call[1] === 'string' ? call[1] : call[1].text;
      expect(content).toContain('Test');
      expect(content).toContain('50.0%');
    });

    it('should handle 0% progress', () => {
      progressBar = new ProgressBar(region, 1, { width: 20 });
      progressBar.update(0, 100);
      
      const call = setLineMock.mock.calls[0];
      const content = typeof call[1] === 'string' ? call[1] : call[1].text;
      expect(content).toContain('0.0%');
    });

    it('should handle 100% progress', () => {
      progressBar = new ProgressBar(region, 1, { width: 20 });
      progressBar.update(100, 100);
      
      const call = setLineMock.mock.calls[0];
      const content = typeof call[1] === 'string' ? call[1] : call[1].text;
      expect(content).toContain('100.0%');
    });

    it('should clamp progress above 100%', () => {
      progressBar = new ProgressBar(region, 1, { width: 20 });
      progressBar.update(150, 100);
      
      const call = setLineMock.mock.calls[0];
      const content = typeof call[1] === 'string' ? call[1] : call[1].text;
      expect(content).toContain('100.0%');
    });

    it('should clamp progress below 0%', () => {
      progressBar = new ProgressBar(region, 1, { width: 20 });
      progressBar.update(-10, 100);
      
      const call = setLineMock.mock.calls[0];
      const content = typeof call[1] === 'string' ? call[1] : call[1].text;
      expect(content).toContain('0.0%');
    });

    it('should calculate correct bar fill', () => {
      progressBar = new ProgressBar(region, 1, { width: 10 });
      progressBar.update(5, 10);
      
      const call = setLineMock.mock.calls[0];
      const barText = typeof call[1] === 'string' ? call[1] : call[1].text;
      // New format uses ☾ ━━━━━ ───── ☽ (moon brackets facing each other, ━ for filled, ─ for empty)
      // Extract the bar part (between brackets with padding)
      // Format: "label ☾ bar ☽ percentage%"
      const barMatch = barText.match(/☾ (.*) ☽/);
      const barContent = barMatch ? barMatch[1] : '';
      const completeCount = (barContent.match(/━/g) || []).length;
      const incompleteCount = (barContent.match(/─/g) || []).length;
      expect(completeCount).toBe(5);
      expect(incompleteCount).toBe(5);
    });
  });

  describe('setLabel', () => {
    it('should update label and re-render', () => {
      progressBar = new ProgressBar(region, 1, { label: 'Initial', width: 20 });
      progressBar.update(50, 100);
      
      progressBar.setLabel('Updated');
      
      expect(setLineMock).toHaveBeenCalledTimes(2);
      const lastCall = setLineMock.mock.calls[1];
      const content = typeof lastCall[1] === 'string' ? lastCall[1] : lastCall[1].text;
      expect(content).toContain('Updated');
    });
  });

  describe('finish', () => {
    it('should set progress to 100%', () => {
      progressBar = new ProgressBar(region, 1, { width: 20 });
      progressBar.update(30, 100);
      progressBar.finish();
      
      const calls = setLineMock.mock.calls;
      const lastCall = calls[calls.length - 1];
      const content = typeof lastCall[1] === 'string' ? lastCall[1] : lastCall[1].text;
      expect(content).toContain('100.0%');
    });
  });

  describe('custom styles', () => {
    it('should use custom complete and incomplete characters', () => {
      progressBar = new ProgressBar(region, 1, {
        width: 10,
        style: {
          complete: '=',
          incomplete: '-',
        },
      });
      progressBar.update(5, 10);
      
      const call = setLineMock.mock.calls[0];
      const content = typeof call[1] === 'string' ? call[1] : call[1].text;
      expect(content).toContain('=');
      expect(content).toContain('-');
      expect(content).not.toContain('━'); // Should not contain default thick line
      expect(content).not.toContain('─'); // Should not contain default thin line
    });

    it('should use custom brackets', () => {
      progressBar = new ProgressBar(region, 1, {
        width: 10,
        style: {
          brackets: ['<', '>'],
        },
      });
      progressBar.update(5, 10);
      
      const call = setLineMock.mock.calls[0];
      const content = typeof call[1] === 'string' ? call[1] : call[1].text;
      expect(content).toContain('<');
      expect(content).toContain('>');
      expect(content).not.toContain('\u263D'); // ☽
      expect(content).not.toContain('\u263E'); // ☾
    });
  });
});

