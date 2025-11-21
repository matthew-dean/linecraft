// Spinner component - manages its own animation state

import type { Component, RenderContext } from '../component';
import type { Color } from '../types';
import { applyStyle } from '../utils/colors';

export interface SpinnerOptions {
  frames?: string[];
  interval?: number;
  color?: Color;
  autoStart?: boolean; // Start animating automatically (default: true)
}

/**
 * Create a spinner component that manages its own animation state
 * Returns an object with render(), start(), and stop() methods
 */
export function Spinner(options: SpinnerOptions = {}): {
  render: Component;
  start: () => void;
  stop: () => void;
} {
  const {
    frames = ['⠇', '⠋', '⠙', '⠴', '⠋', '⠙', '⠸', '⠴', '⠦'],
    interval = 80,
    color = 'yellow',
    autoStart = true,
  } = options;

  let currentFrameIndex = 0;
  let intervalId: NodeJS.Timeout | null = null;
  let onUpdateCallback: (() => void) | null = null;

  const render: Component = (ctx: RenderContext) => {
    // Store the onUpdate callback from context (set by region)
    if (ctx.onUpdate && !onUpdateCallback) {
      onUpdateCallback = ctx.onUpdate;
      // Start automatically if enabled and callback is available
      if (autoStart) {
        start();
      }
    }
    
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
      // Trigger re-render using the callback from RenderContext
      if (onUpdateCallback) {
        onUpdateCallback();
      }
    }, interval);
  };

  const stop = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  return {
    render,
    start,
    stop,
  };
}

