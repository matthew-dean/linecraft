import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Library } from 'ffi-napi';
import ref from 'ref-napi';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine the library path based on platform
function getLibraryPath(): string {
  const platform = process.platform;
  
  if (platform === 'darwin') {
    return join(__dirname, '../../zig-out/lib/libechokit.dylib');
  } else if (platform === 'win32') {
    return join(__dirname, '../../zig-out/lib/echokit.dll');
  } else {
    return join(__dirname, '../../zig-out/lib/libechokit.so');
  }
}

// Load the Zig library using FFI
const lib = Library(getLibraryPath(), {
  create_region: ['uint64', ['uint32', 'uint32', 'uint32', 'uint32']],
  destroy_region: ['void', ['uint64']],
  set_line: ['void', ['uint64', 'uint32', 'pointer', 'size_t']],
  set: ['void', ['uint64', 'pointer', 'size_t']],
  clear_line: ['void', ['uint64', 'uint32']],
  clear_region: ['void', ['uint64']],
  flush: ['void', ['uint64']],
  set_throttle_fps: ['void', ['uint64', 'uint32']],
});

export interface NativeRegion {
  createRegion(x: number, y: number, width: number, height: number): number;
  destroyRegion(handle: number): void;
  setLine(handle: number, lineNumber: number, content: string): void; // 1-based
  set(handle: number, content: string): void;
  clearLine(handle: number, lineNumber: number): void; // 1-based
  clearRegion(handle: number): void;
  flush(handle: number): void;
  setThrottleFps(handle: number, fps: number): void;
}

export const native: NativeRegion = {
  createRegion: (x: number, y: number, width: number, height: number): number => {
    return Number(lib.create_region(x, y, width, height));
  },
  
  destroyRegion: (handle: number): void => {
    lib.destroy_region(BigInt(handle));
  },
  
  setLine: (handle: number, lineNumber: number, content: string): void => {
    const buf = Buffer.from(content, 'utf8');
    // Allocate a buffer and copy the string data
    const ptr = ref.alloc(buf.length);
    buf.copy(ptr);
    lib.set_line(BigInt(handle), lineNumber, ptr, buf.length);
  },
  
  set: (handle: number, content: string): void => {
    const buf = Buffer.from(content, 'utf8');
    // Allocate a buffer and copy the string data
    const ptr = ref.alloc(buf.length);
    buf.copy(ptr);
    lib.set(BigInt(handle), ptr, buf.length);
  },
  
  clearLine: (handle: number, lineNumber: number): void => {
    lib.clear_line(BigInt(handle), lineNumber);
  },
  
  clearRegion: (handle: number): void => {
    lib.clear_region(BigInt(handle));
  },
  
  flush: (handle: number): void => {
    lib.flush(BigInt(handle));
  },
  
  setThrottleFps: (handle: number, fps: number): void => {
    lib.set_throttle_fps(BigInt(handle), fps);
  },
};

