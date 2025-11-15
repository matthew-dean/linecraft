// Pure TypeScript implementation - no FFI dependencies
// This file is kept for backward compatibility but now just re-exports
// the native TypeScript implementation

export { TerminalRegion as NativeRegion } from './native/region.js';
export * from './native/diff.js';
export * from './native/ansi.js';
export * from './native/buffer.js';
export * from './native/throttle.js';

