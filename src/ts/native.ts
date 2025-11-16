// Pure TypeScript implementation - no FFI dependencies
// This file is kept for backward compatibility but now just re-exports
// the native TypeScript implementation

export { TerminalRegion as NativeRegion } from './native/region';
export * from './native/diff';
export * from './native/ansi';
export * from './native/buffer';
export * from './native/throttle';

