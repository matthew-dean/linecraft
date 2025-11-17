import { describe, it, expect } from 'vitest';
import { Throttle } from './throttle';

describe('Throttle', () => {
  describe('initialization', () => {
    it('should initialize with correct FPS', () => {
      const throttle = new Throttle(60);
      expect(throttle['fps']).toBe(60);
      expect(throttle['minFrameInterval']).toBeGreaterThan(0n);
    });

    it('should calculate correct interval for 60 FPS', () => {
      const throttle = new Throttle(60);
      // 1 second / 60 = ~16.67ms = ~16,666,667 nanoseconds
      const expectedInterval = BigInt(Math.floor(1_000_000_000 / 60));
      expect(throttle['minFrameInterval']).toBe(expectedInterval);
    });
  });

  describe('setFps', () => {
    it('should change FPS correctly', () => {
      const throttle = new Throttle(30);
      throttle.setFps(120);
      expect(throttle['fps']).toBe(120);
      
      const expectedInterval = BigInt(Math.floor(1_000_000_000 / 120));
      expect(throttle['minFrameInterval']).toBe(expectedInterval);
    });
  });

  describe('shouldRender', () => {
    it('should allow first frame', () => {
      const throttle = new Throttle(60);
      const should = throttle.shouldRender();
      expect(should).toBe(true);
    });

    it('should respect interval and block immediate second frame', () => {
      const throttle = new Throttle(1000); // 1 FPS = 1 second interval
      throttle.shouldRender(); // First frame
      
      // Immediately after, should not render (hrtime has nanosecond precision)
      const should = throttle.shouldRender();
      expect(should).toBe(false);
    });

    it('should allow render after interval passes', async () => {
      const throttle = new Throttle(10); // 10 FPS = 100ms interval
      throttle.shouldRender(); // First frame
      
      // Wait for interval to pass
      await new Promise(resolve => setTimeout(resolve, 110));
      
      const should = throttle.shouldRender();
      expect(should).toBe(true);
    });
  });

  describe('timeUntilNextFrame', () => {
    it('should calculate remaining time correctly', () => {
      const throttle = new Throttle(10); // 10 FPS = 100ms interval
      throttle.shouldRender();
      
      const remaining = throttle.timeUntilNextFrame();
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(100); // Should be <= 100ms
    });

    it('should return 0 if interval has passed', async () => {
      const throttle = new Throttle(10);
      throttle.shouldRender();
      
      await new Promise(resolve => setTimeout(resolve, 110));
      const remaining = throttle.timeUntilNextFrame();
      expect(remaining).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very high FPS', () => {
      const throttle = new Throttle(1000); // 1000 FPS
      expect(throttle['fps']).toBe(1000);
      expect(throttle['minFrameInterval']).toBeGreaterThan(0n);
    });

    it('should handle very low FPS', () => {
      const throttle = new Throttle(1); // 1 FPS
      expect(throttle['fps']).toBe(1);
      const expectedInterval = BigInt(1_000_000_000); // 1 second
      expect(throttle['minFrameInterval']).toBe(expectedInterval);
    });
  });

  describe('reset', () => {
    it('should reset the throttle', () => {
      const throttle = new Throttle(60);
      throttle.shouldRender();
      
      throttle.reset();
      expect(throttle['lastFrameTime']).toBe(0n);
    });
  });
});

