// Spinner component - manages its own animation state

import type { Component, RenderContext } from '../component.js';
import type { Color } from '../types.js';
import { applyStyle } from '../utils/colors.js';

export type SpinnerStyle = 'classic-dots' | 'bouncing-bar';

export interface SpinnerOptions {
  style?: SpinnerStyle; // Built-in animation style
  frames?: string[]; // Custom frames (overrides style if provided)
  interval?: number;
  color?: Color | AutoColor;
  autoStart?: boolean; // Start animating automatically (default: true)
}

// Built-in spinner frame definitions
const SPINNER_FRAMES: Record<SpinnerStyle, string[]> = {
  'classic-dots': ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'], // Clockwise rotation with 3 connected dots
  'bouncing-bar': ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂'],
};

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
    style,
    frames,
    interval = 80,
    color = 'accent',
    autoStart = true,
  } = options;

  // Determine which frames to use: custom frames override style
  const finalFrames = frames ?? (style ? SPINNER_FRAMES[style] : ['⠇', '⠋', '⠙', '⠴', '⠋', '⠙', '⠸', '⠴', '⠦']);

  let currentFrameIndex = 0;
  let intervalId: NodeJS.Timeout | null = null;
  let onUpdateCallback: (() => void) | null = null;
  let cleanupRegistered = false;

  const render: Component = (ctx: RenderContext) => {
    // Store the onUpdate callback from context (set by region)
    if (ctx.onUpdate && !onUpdateCallback) {
      onUpdateCallback = ctx.onUpdate;
      // Start automatically if enabled and callback is available
      if (autoStart) {
        start();
      }
    }
    
    // Register cleanup callback to stop the interval when component is removed (only once)
    if (ctx.onCleanup && !cleanupRegistered) {
      cleanupRegistered = true;
      ctx.onCleanup(() => {
        stop();
      });
    }
    
    const frame = finalFrames[currentFrameIndex];
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
      currentFrameIndex = (currentFrameIndex + 1) % finalFrames.length;
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

