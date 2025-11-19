// Spinner component - manages its own animation state

import type { Component, RenderContext } from '../layout/grid';
import type { Color } from '../types';
import { applyStyle } from '../utils/colors';

export interface SpinnerOptions {
  frames?: string[];
  interval?: number;
  color?: Color;
}

/**
 * Create a spinner component that manages its own animation state
 * Returns an object with render(), start(), and stop() methods
 */
export function createSpinner(options: SpinnerOptions = {}): {
  render: Component;
  start: () => void;
  stop: () => void;
} {
  const {
    frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    interval = 80,
    color = 'yellow',
  } = options;

  let currentFrameIndex = 0;
  let intervalId: NodeJS.Timeout | null = null;
  let renderCallback: (() => void) | null = null;

  const render: Component = (ctx: RenderContext) => {
    const frame = frames[currentFrameIndex];
    if (color) {
      return applyStyle(frame, { color });
    }
    return frame;
  };

  const start = () => {
    if (intervalId !== null) {
      return; // Already running
    }

    intervalId = setInterval(() => {
      currentFrameIndex = (currentFrameIndex + 1) % frames.length;
      // Trigger re-render if callback is set
      if (renderCallback) {
        renderCallback();
      }
    }, interval);
  };

  const stop = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  // Expose a way to set the render callback (for region to trigger re-renders)
  // This is a bit of a hack, but necessary for the spinner to update
  (render as any).__setRenderCallback = (callback: () => void) => {
    renderCallback = callback;
  };

  return {
    render,
    start,
    stop,
  };
}

