// Pure TypeScript implementation - no FFI dependencies
// This file is kept for backward compatibility but now just re-exports
// the native TypeScript implementation

export { RegionRenderer as NativeRegion } from './native/region-renderer';
export * from './native/diff';
export * from './native/ansi';
export * from './native/buffer';
export * from './native/throttle';

