// Throttling for frame rate limiting - TypeScript implementation
// Optimized for Node.js high-resolution timing

/**
 * Throttle class for limiting render frequency.
 * Uses high-resolution time (hrtime) for accurate throttling.
 */
export class Throttle {
  private lastFrameTime: bigint = 0n;
  private minFrameInterval: bigint; // nanoseconds
  private fps: number;

  constructor(fps: number = 60) {
    this.fps = fps;
    // Calculate interval in nanoseconds: 1 second / fps
    this.minFrameInterval = BigInt(Math.floor(1_000_000_000 / fps));
  }

  /**
   * Update the target FPS
   */
  setFps(fps: number): void {
    this.fps = fps;
    this.minFrameInterval = BigInt(Math.floor(1_000_000_000 / fps));
  }

  /**
   * Check if we should render now based on throttle settings.
   * Returns true if enough time has passed since last render.
   */
  shouldRender(): boolean {
    const now = process.hrtime.bigint();
    const elapsed = now - this.lastFrameTime;

    if (elapsed >= this.minFrameInterval) {
      this.lastFrameTime = now;
      return true;
    }

    return false;
  }

  /**
   * Get time remaining until next frame can be rendered (in milliseconds).
   * Useful for scheduling the next render.
   */
  timeUntilNextFrame(): number {
    const now = process.hrtime.bigint();
    const elapsed = now - this.lastFrameTime;
    const remaining = this.minFrameInterval - elapsed;

    if (remaining <= 0) {
      return 0;
    }

    // Convert nanoseconds to milliseconds
    return Number(remaining) / 1_000_000;
  }

  /**
   * Reset the throttle (useful for testing or after long pauses)
   */
  reset(): void {
    this.lastFrameTime = 0n;
  }
}

