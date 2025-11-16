import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { Spinner } from './spinner';
import { TerminalRegion } from '../region';

// Mock the region
const createMockRegion = () => {
  const setLineMock = vi.fn();
  const mockRegion = {
    setLine: setLineMock,
  } as unknown as TerminalRegion;
  return { region: mockRegion, setLineMock };
};

describe('Spinner', () => {
  let region: TerminalRegion;
  let setLineMock: MockedFunction<(lineNumber: number, content: string | { text: string; style?: any }) => void>;
  let spinner: Spinner;

  beforeEach(() => {
    vi.useFakeTimers();
    const mock = createMockRegion();
    region = mock.region;
    setLineMock = mock.setLineMock;
  });

  afterEach(() => {
    if (spinner) {
      spinner.stop();
    }
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a spinner with default options', () => {
      spinner = new Spinner(region, 1);
      expect(spinner).toBeDefined();
    });

    it('should create a spinner with custom frames', () => {
      const customFrames = ['-', '\\', '|', '/'];
      spinner = new Spinner(region, 1, { frames: customFrames });
      expect(spinner).toBeDefined();
    });

    it('should create a spinner with custom interval', () => {
      spinner = new Spinner(region, 1, { interval: 200 });
      expect(spinner).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start the spinner and begin rendering', () => {
      spinner = new Spinner(region, 1);
      spinner.start();
      
      expect(setLineMock).toHaveBeenCalled();
    });

    it('should not start multiple times if already running', () => {
      spinner = new Spinner(region, 1);
      spinner.start();
      const callCount1 = setLineMock.mock.calls.length;
      
      spinner.start();
      const callCount2 = setLineMock.mock.calls.length;
      
      expect(callCount2).toBe(callCount1);
    });

    it('should advance frames on interval', () => {
      spinner = new Spinner(region, 1, { interval: 100 });
      spinner.start();
      
      const firstCall = setLineMock.mock.calls[0];
      const firstFrame = firstCall[1];
      
      vi.advanceTimersByTime(100);
      
      expect(setLineMock).toHaveBeenCalledTimes(2);
      const secondCall = setLineMock.mock.calls[1];
      const secondFrame = secondCall[1];
      
      // Frames should be different
      expect(firstFrame).not.toBe(secondFrame);
    });

    it('should cycle through all frames', () => {
      const frames = ['A', 'B', 'C'];
      spinner = new Spinner(region, 1, { frames, interval: 100 });
      spinner.start();
      
      const seenFrames: string[] = [];
      for (let i = 0; i < frames.length; i++) {
        vi.advanceTimersByTime(100);
        const call = setLineMock.mock.calls[i];
        const content = typeof call[1] === 'string' ? call[1] : call[1].text;
        seenFrames.push(content.charAt(0));
      }
      
      // Should have seen all frames
      expect(seenFrames).toContain('A');
      expect(seenFrames).toContain('B');
      expect(seenFrames).toContain('C');
    });
  });

  describe('stop', () => {
    it('should stop the spinner', () => {
      spinner = new Spinner(region, 1);
      spinner.start();
      
      spinner.stop();
      
      // Clear the interval
      vi.advanceTimersByTime(200);
      
      // Should have cleared the line
      const calls = setLineMock.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toBe('');
    });

    it('should not stop if not running', () => {
      spinner = new Spinner(region, 1);
      spinner.stop();
      spinner.stop(); // Should not throw
    });

    it('should clear the spinner line when stopped', () => {
      spinner = new Spinner(region, 1);
      spinner.start();
      spinner.stop();
      
      const calls = setLineMock.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toBe('');
    });
  });

  describe('setText', () => {
    it('should update text and render', () => {
      spinner = new Spinner(region, 1);
      spinner.setText('Loading...');
      
      expect(setLineMock).toHaveBeenCalled();
      const call = setLineMock.mock.calls[0];
      const content = typeof call[1] === 'string' ? call[1] : call[1].text;
      expect(content).toContain('Loading...');
    });

    it('should update text while running', () => {
      spinner = new Spinner(region, 1);
      spinner.start();
      spinner.setText('Processing...');
      
      const calls = setLineMock.mock.calls;
      const lastCall = calls[calls.length - 1];
      const content = typeof lastCall[1] === 'string' ? lastCall[1] : lastCall[1].text;
      expect(content).toContain('Processing...');
    });

    it('should preserve text when frame advances', () => {
      spinner = new Spinner(region, 1, { interval: 100 });
      spinner.setText('Working');
      spinner.start();
      
      vi.advanceTimersByTime(100);
      
      const calls = setLineMock.mock.calls;
      const lastCall = calls[calls.length - 1];
      const content = typeof lastCall[1] === 'string' ? lastCall[1] : lastCall[1].text;
      expect(content).toContain('Working');
    });
  });

  describe('custom frames', () => {
    it('should use custom frames', () => {
      const customFrames = ['-', '\\', '|', '/'];
      spinner = new Spinner(region, 1, { frames: customFrames, interval: 100 });
      spinner.start();
      
      const firstCall = setLineMock.mock.calls[0];
      const content = typeof firstCall[1] === 'string' ? firstCall[1] : firstCall[1].text;
      const firstChar = content.charAt(0);
      expect(customFrames).toContain(firstChar);
    });
  });

  describe('custom interval', () => {
    it('should use custom interval', () => {
      spinner = new Spinner(region, 1, { interval: 200 });
      spinner.start();
      
      const callCount1 = setLineMock.mock.calls.length;
      vi.advanceTimersByTime(100);
      const callCount2 = setLineMock.mock.calls.length;
      
      // Should not have advanced yet
      expect(callCount2).toBe(callCount1);
      
      vi.advanceTimersByTime(100);
      const callCount3 = setLineMock.mock.calls.length;
      
      // Should have advanced now
      expect(callCount3).toBeGreaterThan(callCount2);
    });
  });
});

