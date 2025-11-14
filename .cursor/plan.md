# EchoKit - High-Performance Terminal UI Library

## Overview

EchoKit is a high-performance terminal UI library for Node.js that uses Zig for the performance-critical terminal rendering operations. It provides a friendly TypeScript API while leveraging Zig's speed and efficiency for terminal operations.

## Core Philosophy

- **Zig handles performance**: Diffing, ANSI operations, buffering, flushing
- **Node.js handles logic**: UI components, state management, user API
- **Region-based rendering**: Manage a region of the terminal, not just single lines
- **Zero-copy where possible**: Minimize data movement between Node and Zig
- **Lock-free updates**: Support concurrent progress updates without blocking

## Architecture

### High-Level Flow

```
Node.js (TypeScript)
  ↓ (calls renderer API)
Zig Native Addon (via N-API/FFI)
  ↓ (manages terminal region)
Terminal (via stdout/stderr)
```

### Component Responsibilities

#### Zig Layer (`src/zig/`)

**Core Responsibilities:**
1. **Region Management**
   - Track a rectangular region of the terminal
   - Handle cursor positioning within the region
   - Manage region boundaries and scrolling

2. **Double-Buffer Diffing**
   - Maintain previous frame state
   - Compare current frame vs previous frame
   - Generate minimal ANSI operations for changes only
   - Line-level diffing (detect which lines changed)

3. **ANSI Cursor Movement**
   - Efficient cursor positioning (up/down/left/right)
   - Save/restore cursor position
   - Hide/show cursor during updates
   - Clear operations (line, region, to end of line)

4. **Buffering & Flushing**
   - Buffer ANSI operations
   - Batch writes to stdout/stderr
   - Flush at appropriate times (frame boundaries, explicit flush)

5. **Redraw Throttling**
   - Limit redraw frequency (e.g., max 60 FPS)
   - Queue updates and batch them
   - Skip intermediate frames if updates come too fast

6. **Lock-Free Progress Updates**
   - Atomic counters for progress values
   - Thread-safe update operations
   - Support parallel progress lanes

7. **Performance Optimizations**
   - Zero-allocation hot paths where possible
   - Efficient string handling
   - Minimal system calls
   - Fast ANSI code generation

**Zig API Surface (C ABI):**

```zig
// Region management
export fn create_region(x: u32, y: u32, width: u32, height: u32) RegionHandle;
export fn destroy_region(handle: RegionHandle) void;
export fn resize_region(handle: RegionHandle, width: u32, height: u32) void;

// Line updates (automatically batched and throttled by Zig)
// Note: line_number is 1-based (line 1 = first line)
export fn set_line(handle: RegionHandle, line_number: u32, content: [*]const u8, len: usize) void;
// Zig internally:
//   - Convert to 0-based: line_index = line_number - 1
//   - If line_index >= current height: expand region height
//   - Buffers the update in pending_frame
//   - Schedules a render (respecting throttle)
//   - On render: diffs vs previous_frame, generates ANSI, writes to buffer

// Set entire content (multiple lines with \n separators)
export fn set(handle: RegionHandle, content: [*]const u8, len: usize) void;
// Zig internally:
//   - Split by \n to get lines
//   - Expand region height if needed
//   - Update all lines in pending_frame
//   - Schedule render

// Clear operations
export fn clear_line(handle: RegionHandle, line_number: u32) void; // 1-based
export fn clear_region(handle: RegionHandle) void;

// Note: Progress tracking is handled at the component level (ProgressBar)
// The atomic progress updates in Zig are an internal implementation detail
// for lock-free updates when multiple threads update progress concurrently

// Flushing and throttling
export fn flush(handle: RegionHandle) void; // Force immediate render of pending updates
export fn set_throttle_fps(handle: RegionHandle, fps: u32) void;

// ANSI utilities (internal, but exposed for testing/debugging)
export fn ansi_move_cursor(x: u32, y: u32) [*]const u8;
export fn ansi_clear_line() [*]const u8;
export fn ansi_hide_cursor() [*]const u8;
export fn ansi_show_cursor() [*]const u8;
```

#### Node.js Layer (`src/ts/`)

**Core Responsibilities:**
1. **User-Friendly API**
   - TypeScript interfaces for all operations
   - High-level abstractions (lines, colors, components)
   - Event-driven updates
   - Promise-based async operations

2. **UI Components**
   - Progress bars
   - Spinners
   - Text lines with styling
   - Multi-line layouts
   - Status indicators

3. **State Management**
   - Track component state
   - Handle user updates
   - Queue render operations
   - Manage component lifecycle

4. **Zig Integration**
   - Load Zig native addon
   - Bridge TypeScript API to Zig C ABI
   - Handle memory management
   - Error handling and validation

**TypeScript API Design:**

```typescript
// Core renderer
interface TerminalRegion {
  width: number;
  height: number; // Current height (may expand dynamically)
  
  // Set individual line (1-based: line 1 is the first line)
  // If line index > current height, region automatically expands
  setLine(lineNumber: number, content: string | LineContent): void;
  
  // Set entire contents (with line breaks) - replaces all lines
  set(content: string | LineContent[]): void;
  
  // Clear operations
  clearLine(index: number): void;
  clear(): void;
  
  // Flushing (optional - Zig auto-flushes based on throttle)
  flush(): void; // Force immediate render of pending updates
  
  // Configuration
  setThrottle(fps: number): void; // Set max render rate (default: 60)
  
  // Cleanup
  destroy(): void;
}

// Region creation options
interface RegionOptions {
  x?: number; // Default: 0
  y?: number; // Default: 0
  width?: number; // Default: terminal width
  height?: number; // Default: 1 (expands as needed)
}

// Line content with styling
interface LineContent {
  text: string;
  style?: TextStyle;
}

interface TextStyle {
  color?: Color;
  backgroundColor?: Color;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

// High-level components
interface ProgressBar {
  update(percentage: number): void;
  setLabel(label: string): void;
  finish(): void;
}

interface Spinner {
  start(): void;
  stop(): void;
  setText(text: string): void;
}

// Factory functions
function createRegion(options: RegionOptions): TerminalRegion;
function createProgressBar(region: TerminalRegion, options: ProgressBarOptions): ProgressBar;
function createSpinner(region: TerminalRegion, options: SpinnerOptions): Spinner;
```

## Project Structure

```
echokit/  # Package name: "echokit" (lowercase)
├── package.json                 # PNPM package config, MIT license
├── pnpm-lock.yaml
├── tsconfig.json                # TypeScript config
├── build.zig                    # Zig build script
├── build/                       # Build output
│   ├── echokit.node             # Compiled native addon
│   └── lib/                     # Compiled TypeScript
├── src/
│   ├── zig/                     # Zig source code
│   │   ├── renderer.zig         # Core rendering engine
│   │   ├── diff.zig              # Diffing algorithms
│   │   ├── ansi.zig              # ANSI code generation
│   │   ├── buffer.zig            # Buffering logic
│   │   ├── region.zig            # Region management
│   │   ├── progress.zig          # Progress tracking (atomic)
│   │   └── throttle.zig          # Redraw throttling
│   └── ts/                       # TypeScript source
│       ├── index.ts              # Main entry point
│       ├── region.ts             # TerminalRegion implementation
│       ├── native.ts             # Zig addon bindings
│       ├── components/
│       │   ├── progress-bar.ts
│       │   ├── spinner.ts
│       │   └── text-line.ts
│       ├── utils/
│       │   ├── colors.ts
│       │   └── ansi.ts
│       └── types.ts              # TypeScript type definitions
├── examples/
│   ├── basic-progress.ts
│   ├── multi-lane.ts
│   ├── spinner.ts
│   └── custom-layout.ts
├── tests/
│   ├── zig/                      # Zig unit tests
│   └── ts/                       # TypeScript tests
└── README.md
```

## Implementation Details

### Zig Implementation

#### 1. Region Management (`region.zig`)

```zig
const Region = struct {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    pending_frame: [][]u8,      // Current updates (being built)
    previous_frame: [][]u8,      // Last rendered frame (for diffing)
    render_scheduled: bool,     // Is a render scheduled?
    last_render_time: i64,      // Last render timestamp (for throttling)
    throttle: Throttle,          // Throttling state
    buffer: RenderBuffer,        // ANSI output buffer
    
    pub fn init(allocator: Allocator, x: u32, y: u32, width: u32, height: u32) !Region {
        // Allocate frame buffers
        // Initialize throttle (default 60 FPS)
        // Initialize render buffer
    }
    
    pub fn deinit(self: *Region) void {
        // Free frame buffers
        // Flush any pending renders
    }
    
    pub fn set_line(self: *Region, line_number: u32, content: []const u8) !void {
        // Convert 1-based to 0-based
        if (line_number == 0) {
            return error.InvalidLineNumber; // Line numbers start at 1
        }
        const line_index = line_number - 1;
        
        // If line_index >= height, expand region
        if (line_index >= self.height) {
            try self.expand_to(line_index + 1);
        }
        
        // Ensure pending_frame has enough lines
        while (self.pending_frame.items.len <= line_index) {
            try self.pending_frame.append(self.allocator, &[_]u8{});
        }
        
        // Update pending_frame[line_index]
        self.pending_frame.items[line_index] = try self.allocator.dupe(u8, content);
        
        // Schedule render (respects throttle)
        self.schedule_render();
    }
    
    pub fn set(self: *Region, content: []const u8) !void {
        // Split by \n to get lines
        var lines = std.ArrayList([]const u8).init(self.allocator);
        defer lines.deinit();
        
        var it = std.mem.splitScalar(u8, content, '\n');
        while (it.next()) |line| {
            try lines.append(line);
        }
        
        // Expand region if needed
        if (lines.items.len > self.height) {
            try self.expand_to(@intCast(lines.items.len));
        }
        
        // Update all lines in pending_frame
        try self.pending_frame.resize(self.allocator, lines.items.len);
        for (lines.items, 0..) |line, i| {
            self.pending_frame.items[i] = try self.allocator.dupe(u8, line);
        }
        
        // Schedule render
        self.schedule_render();
    }
    
    pub fn expand_to(self: *Region, new_height: u32) !void {
        // Expand previous_frame and pending_frame
        // Update height
        self.height = new_height;
    }
    
    pub fn schedule_render(self: *Region) void {
        // Check throttle - should we render now?
        // If yes: call render_now()
        // If no: mark render_scheduled = true, will render on next throttle tick
    }
    
    pub fn render_now(self: *Region) !void {
        // Diff pending_frame vs previous_frame
        // Generate ANSI operations
        // Write to buffer
        // Flush buffer
        // Copy pending_frame to previous_frame
        // Clear pending_frame
    }
    
    pub fn resize(self: *Region, new_width: u32, new_height: u32) !void {
        // Reallocate frames
    }
}
```

#### 2. Diffing (`diff.zig`)

```zig
const DiffOp = union(enum) {
    no_change: void,
    update_line: struct { line: u32, content: []const u8 },
    insert_line: struct { line: u32, content: []const u8 },
    delete_line: u32,
};

pub fn diff_frames(
    prev: [][]const u8,
    curr: [][]const u8,
    allocator: Allocator
) ![]DiffOp {
    // Compare line by line
    // Generate minimal diff operations
    // Return array of operations
}
```

#### 3. ANSI Operations (`ansi.zig`)

```zig
pub fn move_cursor_to(x: u32, y: u32) []const u8 {
    // Generate: \x1b[{y};{x}H
}

pub fn move_cursor_up(n: u32) []const u8 {
    // Generate: \x1b[{n}A
}

pub fn clear_line() []const u8 {
    // Generate: \x1b[2K
}

pub fn hide_cursor() []const u8 {
    // Generate: \x1b[?25l
}

pub fn show_cursor() []const u8 {
    // Generate: \x1b[?25h
}
```

#### 4. Buffering (`buffer.zig`)

```zig
const RenderBuffer = struct {
    data: std.ArrayList(u8),
    stdout: std.fs.File,
    
    pub fn init(allocator: Allocator, stdout: std.fs.File) RenderBuffer {
        return .{
            .data = std.ArrayList(u8).init(allocator),
            .stdout = stdout,
        };
    }
    
    pub fn write(self: *RenderBuffer, bytes: []const u8) !void {
        try self.data.appendSlice(bytes);
    }
    
    pub fn flush(self: *RenderBuffer) !void {
        try self.stdout.writeAll(self.data.items);
        self.data.clearRetainingCapacity();
    }
};
```

#### 5. Throttling (`throttle.zig`)

```zig
const Throttle = struct {
    last_frame_time: i64,
    min_frame_interval: i64, // nanoseconds (calculated from FPS)
    fps: u32,
    
    pub fn init(fps: u32) Throttle {
        const interval_ns = 1_000_000_000 / @as(i64, fps);
        return .{
            .last_frame_time = 0,
            .min_frame_interval = interval_ns,
            .fps = fps,
        };
    }
    
    pub fn set_fps(self: *Throttle, fps: u32) void {
        self.fps = fps;
        self.min_frame_interval = 1_000_000_000 / @as(i64, fps);
    }
    
    pub fn should_render(self: *Throttle) bool {
        const now = std.time.nanoTimestamp();
        if (now - self.last_frame_time >= self.min_frame_interval) {
            self.last_frame_time = now;
            return true;
        }
        return false;
    }
    
    pub fn time_until_next_frame(self: *Throttle) i64 {
        const now = std.time.nanoTimestamp();
        const elapsed = now - self.last_frame_time;
        const remaining = self.min_frame_interval - elapsed;
        return if (remaining > 0) remaining else 0;
    }
};
```

#### 6. Progress Tracking (Internal - for lock-free updates)

Progress tracking uses atomic operations internally for lock-free updates when multiple threads/async operations update progress concurrently. This is an implementation detail - the user-facing API is `createProgressBar()` which handles everything.

```zig
// Internal: Atomic progress values (used by ProgressBar component)
const ProgressState = struct {
    current: std.atomic.Value(u64),
    total: std.atomic.Value(u64),
    
    pub fn update(self: *ProgressState, value: u64, max: u64) void {
        _ = self.current.store(value, .Release);
        _ = self.total.store(max, .Release);
    }
    
    pub fn get(self: *ProgressState) struct { current: u64, total: u64 } {
        return .{
            .current = self.current.load(.Acquire),
            .total = self.total.load(.Acquire),
        };
    }
};
```

### Node.js Implementation

#### 1. Native Addon Binding (`native.ts`)

```typescript
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the compiled Zig addon
const addon = require(join(__dirname, '../build/echokit.node'));

export interface NativeRegion {
  createRegion(x: number, y: number, width: number, height: number): number;
  destroyRegion(handle: number): void;
  setLine(handle: number, lineNumber: number, content: string): void; // 1-based
  set(handle: number, content: string): void;
  clearLine(handle: number, lineNumber: number): void; // 1-based
  clearRegion(handle: number): void;
  flush(handle: number): void;
  setThrottleFps(handle: number, fps: number): void;
  // ... other methods
}

export const native: NativeRegion = addon;
```

#### 2. TerminalRegion (`region.ts`)

```typescript
import { native } from './native.js';

export class TerminalRegion {
  private handle: number;
  private width: number;
  private _height: number; // Current height (may expand)
  
  constructor(options: RegionOptions = {}) {
    const x = options.x ?? 0;
    const y = options.y ?? 0;
    this.width = options.width ?? process.stdout.columns ?? 80;
    this._height = options.height ?? 1; // Default to 1 line, expands as needed
    this.handle = native.createRegion(x, y, this.width, this._height);
  }
  
  get width(): number {
    return this.width;
  }
  
  get height(): number {
    return this._height;
  }
  
  setLine(lineNumber: number, content: string | LineContent): void {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }
    
    // Zig handles batching and expansion automatically
    const text = typeof content === 'string' ? content : content.text;
    // Apply styling if provided
    const styled = this.applyStyle(text, typeof content === 'object' ? content.style : undefined);
    native.setLine(this.handle, lineNumber, styled);
    // Zig will:
    //   - Convert to 0-based internally
    //   - Expand region if lineNumber > current height
    //   - Buffer this update in pending_frame
    //   - Check throttle
    //   - Schedule render if needed (or render immediately if throttle allows)
    
    // Update our height tracking if Zig expanded
    if (lineNumber > this._height) {
      this._height = lineNumber;
    }
  }
  
  set(content: string | LineContent[]): void {
    if (typeof content === 'string') {
      // Single string with \n line breaks
      native.set(this.handle, content);
      // Update height based on line count
      this._height = content.split('\n').length;
    } else {
      // Array of LineContent
      const lines = content.map(c => 
        this.applyStyle(c.text, c.style)
      ).join('\n');
      native.set(this.handle, lines);
      this._height = content.length;
    }
  }
  
  clearLine(lineNumber: number): void {
    if (lineNumber < 1) {
      throw new Error('Line numbers start at 1');
    }
    native.clearLine(this.handle, lineNumber);
  }
  
  clear(): void {
    native.clearRegion(this.handle);
  }
  
  flush(): void {
    // Force immediate render of any pending updates (bypasses throttle)
    native.flush(this.handle);
  }
  
  setThrottle(fps: number): void {
    native.setThrottleFps(this.handle, fps);
  }
  
  destroy(): void {
    native.destroyRegion(this.handle);
  }
  
  private applyStyle(text: string, style?: TextStyle): string {
    // Convert TextStyle to ANSI codes
    // Return styled string
  }
}
```

#### 3. Progress Bar Component (`components/progress-bar.ts`)

```typescript
import { TerminalRegion } from '../region.js';

export interface ProgressBarOptions {
  label?: string;
  width?: number;
  style?: {
    complete?: string;
    incomplete?: string;
    brackets?: [string, string];
  };
}

export class ProgressBar {
  private region: TerminalRegion;
  private lineNumber: number; // 1-based
  private current: number = 0;
  private total: number = 100;
  private label: string;
  private width: number;
  
  constructor(region: TerminalRegion, lineNumber: number, options: ProgressBarOptions = {}) {
    this.region = region;
    this.lineNumber = lineNumber;
    this.label = options.label || '';
    this.width = options.width || 40;
  }
  
  update(current: number, total: number): void {
    this.current = current;
    this.total = total;
    this.render();
  }
  
  setLabel(label: string): void {
    this.label = label;
    this.render();
  }
  
  private render(): void {
    const percentage = Math.min(100, Math.max(0, (this.current / this.total) * 100));
    const filled = Math.floor((percentage / 100) * this.width);
    const empty = this.width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const text = `${this.label} [${bar}] ${percentage.toFixed(1)}%`;
    
    // Just update the line - Zig handles batching and rendering
    this.region.setLine(this.lineNumber, text);
    // Optional: call flush() if you need immediate rendering
  }
  
  finish(): void {
    this.update(this.total, this.total);
  }
}
```

#### 4. Spinner Component (`components/spinner.ts`)

```typescript
import { TerminalRegion } from '../region.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Spinner {
  private region: TerminalRegion;
  private lineNumber: number; // 1-based
  private frameIndex: number = 0;
  private text: string = '';
  private interval?: NodeJS.Timeout;
  private isRunning: boolean = false;
  
  constructor(region: TerminalRegion, lineNumber: number) {
    this.region = region;
    this.lineNumber = lineNumber;
  }
  
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.interval = setInterval(() => {
      this.render();
      this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;
    }, 100);
  }
  
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
    }
    // Clear the spinner line
    this.region.setLine(this.lineNumber, '');
  }
  
  setText(text: string): void {
    this.text = text;
    this.render();
  }
  
  private render(): void {
    const frame = SPINNER_FRAMES[this.frameIndex];
    const line = `${frame} ${this.text}`;
    
    // Just update the line - Zig handles batching and rendering
    this.region.setLine(this.lineNumber, line);
    // Spinner updates frequently, so Zig's throttling will handle smooth animation
  }
}
```

## Build System

### Zig Build (`build.zig`)

```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const lib = b.addSharedLibrary(.{
        .name = "echokit",
        .root_source_file = b.path("src/zig/renderer.zig"),
        .target = target,
        .optimize = optimize,
    });

    // Link with Node.js N-API
    lib.linkLibC();
    // Add N-API headers path
    
    b.installArtifact(lib);
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "build:zig": "zig build",
    "build:ts": "tsc",
    "build": "pnpm build:zig && pnpm build:ts",
    "dev": "pnpm build:zig && pnpm build:ts --watch",
    "test": "vitest",
    "example:progress": "tsx examples/basic-progress.ts"
  }
}
```

## Features Checklist

### Core Features (Zig)
- [x] Region management (rectangular terminal area)
- [x] Double-buffer diffing (line-level)
- [x] ANSI cursor movement
- [x] Buffering and flushing
- [x] Redraw throttling
- [x] Lock-free progress updates (atomic operations)
- [x] Parallel progress lanes support

### API Features (Node.js)
- [x] TypeScript API
- [x] Automatic batching (Zig handles it)
- [x] Simple setLine() API (no manual frame management)
- [x] Optional flush() for immediate rendering
- [x] Color/styling support
- [x] Progress bar component
- [x] Spinner component
- [x] Text line component
- [x] Multi-line layout support

### Performance Features
- [x] Zero-allocation hot paths (where possible)
- [x] Minimal system calls
- [x] Efficient string handling
- [x] Fast ANSI code generation
- [x] Batch operations

## Example Usage

### Basic Progress Bar

```typescript
import { createRegion, createProgressBar } from 'echokit'; // Package: "echokit"

// Region defaults to 1 line, expands as needed
const region = createRegion({ width: 80 });
const progress = createProgressBar(region, 1, { // Line 1 (first line)
  label: 'Installing packages',
  width: 50,
});

for (let i = 0; i <= 100; i++) {
  progress.update(i, 100);
  await new Promise(resolve => setTimeout(resolve, 50));
}

progress.finish();
region.destroy();
```

### Multi-Lane Progress

```typescript
import { createRegion, createProgressBar } from 'echokit'; // Package: "echokit"

// Region starts at 1 line, expands to 3 as we add progress bars
const region = createRegion({ width: 80 });

const download = createProgressBar(region, 1, { label: 'Downloading' }); // Line 1
const extract = createProgressBar(region, 2, { label: 'Extracting' });    // Line 2 (expands region)
const install = createProgressBar(region, 3, { label: 'Installing' });    // Line 3 (expands region)

// Update lanes concurrently
Promise.all([
  updateProgress(download, 100),
  updateProgress(extract, 100),
  updateProgress(install, 100),
]);

region.destroy();
```

### Spinner with Text

```typescript
import { createRegion, createSpinner } from 'echokit'; // Package: "echokit"

// Region defaults to 1 line
const region = createRegion({ width: 80 });
const spinner = createSpinner(region, 1); // Line 1

spinner.setText('Processing...');
spinner.start();

// Do work...
await doWork();

spinner.stop();
region.destroy();
```

### Custom Layout

```typescript
import { createRegion } from 'echokit'; // Package: "echokit"

// Region starts at 1 line, expands as we add lines
const region = createRegion({ width: 80 });

// Just update lines - Zig automatically batches, expands, and renders efficiently
region.setLine(1, { text: 'Status:', style: { bold: true } });      // Line 1
region.setLine(2, '  ✓ Connected');        // Line 2 (expands to 2 lines)
region.setLine(3, '  ⏳ Processing...');    // Line 3 (expands to 3 lines)
region.setLine(4, { text: '  ✗ Error', style: { color: 'red' } }); // Line 4 (expands to 4 lines)

// Or set entire content at once:
region.set(`Status:
  ✓ Connected
  ⏳ Processing...
  ✗ Error`);

// Optional: force immediate render (otherwise Zig will render based on throttle)
// region.flush();
```

## Testing Strategy

### Zig Tests
- Unit tests for diffing algorithm
- Unit tests for ANSI code generation
- Integration tests for region management
- Performance benchmarks

### TypeScript Tests
- Unit tests for components
- Integration tests for region API
- E2E tests with actual terminal output

## Performance Targets

- **Frame rate**: 60+ FPS for smooth animations
- **Latency**: < 16ms per frame
- **Memory**: Minimal allocations in hot paths
- **CPU**: Efficient diffing (O(n) where n = number of lines)

## Future Enhancements

1. **More Components**
   - Tables
   - Trees
   - Forms
   - Charts (ASCII)

2. **Advanced Features**
   - Mouse support
   - Keyboard input handling
   - Window resizing detection
   - Terminal detection (capabilities)

3. **Optimizations**
   - SIMD for diffing (if beneficial)
   - More aggressive buffering
   - Adaptive throttling

4. **Developer Experience**
   - Better error messages
   - Debug mode (show diff operations)
   - Performance profiling tools

## License

MIT License - see LICENSE file

## Dependencies

### Zig
- Standard library only (no external deps)

### Node.js
- TypeScript (dev)
- @types/node (dev)
- Build tools (dev)

