# Linecraft - High-Performance Terminal UI Library

## Overview

Linecraft is a high-performance terminal UI library for Node.js built entirely in TypeScript. It provides a friendly API for building terminal interfaces with components, layouts, and styling, while maintaining excellent performance through optimized rendering techniques.

## Core Philosophy

- **Pure TypeScript**: No native dependencies, no build scripts, works everywhere
- **Region-based rendering**: Manage a region of the terminal, not just single lines
- **Non-destructive**: Regions reserve new lines at the bottom, never overwrite existing content
- **Performance optimized**: Frame diffing, throttling, buffering, and efficient ANSI operations
- **Component-based**: Composable components with flexbox-like layouts
- **Simple API**: Minimal markup for colors and styling

## Architecture

### High-Level Flow

```
TypeScript Components
  ↓ (calls region API)
TerminalRegion (TypeScript)
  ↓ (manages rendering)
Native Rendering Layer (TypeScript)
  ↓ (optimized ANSI operations)
Terminal (via stdout)
```

### Component Responsibilities

#### TypeScript Rendering Layer (`src/ts/native/`)

**Core Responsibilities:**
1. **Region Management** (`native/region.ts`)
   - Track a rectangular region of the terminal
   - Reserve new lines at the bottom (non-destructive)
   - Handle relative cursor positioning within the region
   - Manage region boundaries and expansion
   - Auto-resize support (reacts to terminal resize events)
   - Automatic cleanup on process exit

2. **Double-Buffer Diffing** (`native/diff.ts`)
   - Maintain previous frame state
   - Compare current frame vs previous frame
   - Generate minimal diff operations (update, insert, delete, no-change)
   - Line-level diffing (detect which lines changed)

3. **ANSI Cursor Movement** (`native/ansi.ts`)
   - Efficient cursor positioning (up/down/left/right)
   - Save/restore cursor position
   - Hide/show cursor during updates
   - Clear operations (line, region, to end of line)
   - Line deletion support

4. **Buffering & Flushing** (`native/buffer.ts`)
   - Buffer ANSI operations
   - Batch writes to stdout
   - Single write operation per render cycle

5. **Redraw Throttling** (`native/throttle.ts`)
   - Limit redraw frequency (default 60 FPS)
   - Queue updates and batch them
   - Skip intermediate frames if updates come too fast

6. **Performance Optimizations**
   - Efficient string operations
   - Minimal system calls
   - Fast ANSI code generation
   - Frame diffing to minimize writes

#### High-Level API Layer (`src/ts/`)

**Core Responsibilities:**
1. **User-Friendly API** (`region.ts`, `index.ts`)
   - TypeScript interfaces for all operations
   - High-level abstractions (lines, colors, components)
   - Styling support (colors, bold, italic, underline)
   - Simple factory functions

2. **UI Components** (`components/`)
   - Progress bars (`progress-bar.ts`)
   - Spinners (`spinner.ts`)
   - Text component with overflow handling (`text.ts`)
   - Base component system (`base.ts`)

3. **Layout System** (`layout/`)
   - Flexbox-like layout (`flex.ts`)
   - Row and column directions
   - Gap, justify-content, align-items
   - Min/max width constraints
   - Flex grow/shrink support

4. **Utilities** (`utils/`)
   - Color formatting (`colors.ts`, `colors-simple.ts`)
   - Text manipulation (`text.ts`)
   - Terminal utilities (`terminal.ts`)

5. **Drawing Primitives** (`drawing/`)
   - Boxes (rounded, single, double) (`boxes.ts`)
   - Lines (horizontal, vertical, dividers)
   - Smooth ASCII characters

**TypeScript API Design:**

```typescript
// Core renderer
interface TerminalRegion {
  width: number; // Current width (updates with auto-resize)
  height: number; // Current height (may expand dynamically)
  
  // Set individual line (1-based: line 1 is the first line)
  // If line index > current height, region automatically expands
  setLine(lineNumber: number, content: string | LineContent): void;
  
  // Set entire contents (with line breaks) - replaces all lines
  set(content: string | LineContent[]): void;
  
  // Clear operations
  clearLine(lineNumber: number): void; // 1-based
  clear(): void; // Clear all lines
  
  // Flushing (optional - auto-flushes based on throttle)
  flush(): void; // Force immediate render of pending updates
  
  // Configuration
  setThrottle(fps: number): void; // Set max render rate (default: 60)
  
  // Cleanup (automatically called on process exit)
  destroy(): void; // Cleans up resources, optionally deletes blank lines
}

// Region creation options
interface RegionOptions {
  width?: number; // Default: terminal width (auto-resizes if autoResize: true)
  height?: number; // Default: 1 (expands as needed)
  stdout?: NodeJS.WriteStream; // Default: process.stdout
  disableRendering?: boolean; // For tests - prevents actual rendering
  autoResize?: boolean; // Automatically react to terminal resize events (default: false)
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
linecraft/
├── package.json                 # PNPM package config, MIT license
├── pnpm-lock.yaml
├── tsconfig.json                # TypeScript config
├── vitest.config.ts             # Vitest test configuration
├── lib/                         # Compiled TypeScript output
├── src/
│   └── ts/                       # TypeScript source
│       ├── index.ts              # Main entry point
│       ├── region.ts             # High-level TerminalRegion wrapper
│       ├── native.ts             # Re-exports native implementations
│       ├── native/                # Core rendering engine (TypeScript)
│       │   ├── region.ts         # Region management
│       │   ├── diff.ts           # Diffing algorithms
│       │   ├── ansi.ts           # ANSI code generation
│       │   ├── buffer.ts         # Buffering logic
│       │   └── throttle.ts       # Redraw throttling
│       ├── components/            # UI Components
│       │   ├── base.ts           # Base component class
│       │   ├── text.ts           # Text component with overflow
│       │   ├── progress-bar.ts   # Progress bar component
│       │   └── spinner.ts        # Spinner component
│       ├── layout/               # Layout system
│       │   └── flex.ts           # Flexbox-like layout
│       ├── drawing/              # Drawing primitives
│       │   └── boxes.ts          # Boxes, lines, dividers
│       ├── utils/                # Utilities
│       │   ├── colors.ts         # Color/styling utilities
│       │   ├── colors-simple.ts # Simple color API
│       │   ├── text.ts           # Text manipulation
│       │   └── terminal.ts       # Terminal utilities
│       └── types.ts              # TypeScript type definitions
├── examples/
│   ├── basic-progress.ts
│   ├── multi-lane.ts
│   ├── spinner.ts
│   ├── region-demo.ts
│   └── reactive-resize.ts
├── tests/                        # All tests are TypeScript
│   └── src/ts/                   # TypeScript tests
│       ├── native/               # Tests for native layer
│       ├── components/            # Component tests
│       └── utils/                # Utility tests
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

#### 2. Progress Bar Component (`components/progress-bar.ts`)

```typescript
import { TerminalRegion } from '../region.js';

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
  
  private render(): void {
    const percentage = Math.min(100, Math.max(0, (this.current / this.total) * 100));
    const filled = Math.floor((percentage / 100) * this.width);
    const empty = this.width - filled;
    
    const bar = this.completeChar.repeat(filled) + this.incompleteChar.repeat(empty);
    const text = `${this.label} ${this.brackets[0]}${bar}${this.brackets[1]} ${percentage.toFixed(1)}%`;
    
    // Update the line - rendering is automatically batched and throttled
    this.region.setLine(this.lineNumber, text);
  }
}
```

#### 3. Spinner Component (`components/spinner.ts`)

```typescript
import { TerminalRegion } from '../region.js';

export class Spinner {
  private region: TerminalRegion;
  private lineNumber: number; // 1-based
  private frameIndex: number = 0;
  private text: string = '';
  private interval?: NodeJS.Timeout;
  private isRunning: boolean = false;
  
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.render(); // Render immediately
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.render();
    }, this.intervalMs);
  }
  
  private render(): void {
    const frame = this.frames[this.frameIndex];
    const line = `${frame} ${this.text}`;
    this.region.setLine(this.lineNumber, line);
  }
}
```

## Build System

### TypeScript Build

Pure TypeScript - no native compilation needed:

```json
{
  "scripts": {
    "build:ts": "tsc",
    "build": "pnpm build:ts",
    "dev": "pnpm build:ts --watch",
    "test": "vitest",
    "example:progress": "tsx examples/basic-progress.ts",
    "example:resize": "tsx examples/reactive-resize.ts"
  }
}
```

**No build scripts approval needed** - works out of the box with pnpm, npm, yarn.

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

### Basic Progress Bar (Component System)

```typescript
import { createRegion, flex, col, progressBar } from 'linecraft';

const region = createRegion({ width: 80 });

// Use progressBar helper function that returns a string
let current = 0;
const total = 100;

function updateProgress() {
  region.set(
    flex({ gap: 2 },
      col({}, 'Installing packages'),
      col({ flex: 1 }, progressBar({ current, total, width: 50 }))
    )
  );
}

// Update in a loop
for (let i = 0; i <= 100; i++) {
  current = i;
  updateProgress();
  await new Promise(resolve => setTimeout(resolve, 50));
}

// destroy() is automatically called on process exit
// Pass true to clear before destroying: region.destroy(true)
region.destroy();
```

### Multi-Lane Progress (Component System)

```typescript
import { createRegion, flex, col, progressBar } from 'linecraft';

const region = createRegion({ width: 80 });

let downloadProgress = 0;
let extractProgress = 0;
let installProgress = 0;

function updateAll() {
  region.set(
    flex({ gap: 0, direction: 'column' },
      flex({ gap: 2 },
        col({}, 'Downloading'),
        col({ flex: 1 }, progressBar({ current: downloadProgress, total: 100 }))
      ),
      flex({ gap: 2 },
        col({}, 'Extracting'),
        col({ flex: 1 }, progressBar({ current: extractProgress, total: 100 }))
      ),
      flex({ gap: 2 },
        col({}, 'Installing'),
        col({ flex: 1 }, progressBar({ current: installProgress, total: 100 }))
      )
    )
  );
}

// Update concurrently
await Promise.all([
  updateProgress('download', 100),
  updateProgress('extract', 100),
  updateProgress('install', 100),
]);

region.destroy();
```

### Spinner with Text (Component System)

```typescript
import { createRegion, flex, col, spinner } from 'linecraft';

const region = createRegion({ width: 80 });

// Spinner helper returns a string (first frame for static use)
// For animated spinners, use the Spinner component class
region.set(
  flex({ gap: 1 },
    col({}, spinner('Processing...'))
  )
);

// For animated spinner, use the component:
import { Spinner } from 'linecraft';
const spinnerComponent = new Spinner(region, 1);
spinnerComponent.setText('Processing...');
spinnerComponent.start();

// Do work...
await doWork();

spinnerComponent.stop();
region.destroy();
```

### Reactive Resize

```typescript
import { createRegion } from 'linecraft';

// Enable auto-resize to react to terminal size changes
const region = createRegion({
  height: 3,
  autoResize: true, // Automatically updates width when terminal resizes
});

region.setLine(1, 'This will adapt to terminal width!');
// Resize your terminal window and watch it update
```

### Component System with Flex Layout

```typescript
import { createRegion } from 'linecraft';
import { Flex } from 'linecraft/layout/flex';
import { Text } from 'linecraft/components/text';
import { c } from 'linecraft/utils/colors-simple';

const region = createRegion();

// Use the simplified API with flex() and col()
region.set(
  flex({ gap: 2 },
    col({ min: 8, max: 8 }, color('bold', 'Status:')),
    col({ flex: 1, overflow: 'ellipsis-end', min: 10 }, color('green', 'Connected'))
  )
);
```

### ASCII Drawing

```typescript
import { createRegion } from 'linecraft';
import { drawRoundedBox, drawDivider } from 'linecraft/drawing/boxes';

const region = createRegion({ height: 10 });

// Draw a box
const box = drawRoundedBox(30, 5);
box.forEach((line, i) => {
  region.setLine(i + 1, line);
});

// Draw a divider
const divider = drawDivider(30, 'single', '├', '┤');
region.setLine(7, divider);
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

- **Frame rate**: 60+ FPS for smooth animations (throttled by default)
- **Latency**: < 16ms per frame
- **Memory**: Efficient string operations, minimal allocations
- **CPU**: Efficient diffing (O(n) where n = number of lines)
- **Writes**: Single batched write per render cycle
- **No native dependencies**: Pure TypeScript, fast startup

## Component System Architecture

### Overview

The component system provides a flexible, composable way to build terminal UIs with:
- **Markup-based DSL**: Simple XML-like syntax for declarative UI
- **Inline styling**: BBCode-style color codes (`[red]`, `[#58F1f0]`, `[/]`)
- **Component composition**: Register and use components in markup
- **Flexbox-like layout**: Built-in `<Flex>` component
- **Text overflow handling**: Automatic ellipsis and wrapping
- **ASCII drawing primitives**: Boxes, lines, dividers

### Function-Based API Design

We're using a function-based API - simple, type-safe, and no parser needed!

#### Simplified API (Current Implementation)

**Key Features:**
- **Strings are handled directly** - no interface needed for simple components
- **Arrays are auto-flattened** - functional components can return arrays
- **Only complex components implement Renderable** - Col (with wrapping) and nested Flex

```typescript
import { flex, col, color } from 'linecraft';

// Simple - just strings
region.set(flex({ gap: 2 }, 'Status:', 'Connected'));

// With colors
region.set(flex({ gap: 2 }, 
  'Status:',
  color('green', 'Connected')
));

// Functional components can return arrays
function statusBar(status: string, ...children: any[]) {
  return [
    'Status: ',
    color('green', status),
    ' | ',
    ...children
  ];
}

region.set(flex({ gap: 1 }, ...statusBar('Connected', 'Users: 42')));

// Complex components (Col with options)
region.set(flex({ gap: 2 },
  'Label:',
  col({ flex: 1 }, color('cyan', 'This grows')),
  col({ min: 10, overflow: 'wrap' }, 'Long text that wraps')
));
```

**Benefits:**
- ✅ Minimal API surface - most components don't need to implement anything
- ✅ Type-safe - full TypeScript support
- ✅ Composable - functional components can return arrays
- ✅ Flexible - strings, Renderables, or arrays all work

#### Previous Design Options (Archived)

```typescript
// Shorter component names
region.set(`<f gap=2>
  <col min=8>Status:</col>
  <col grow>Connected</col>
</f>`);

// Or with colons
region.set(`<flex gap=2>
  <col min=8>Status:</col>
  <col grow>Connected</col>
</flex>`);
```

**Pros:** Less typing, no quotes needed  
**Cons:** Less readable, still verbose

#### Option 3: Function-like Syntax

```typescript
// Function calls with named args
region.set(`flex(gap=2,
  text(min-width=8, "Status:"),
  text(flex-grow=1, "Connected")
)`);
```

**Pros:** Very compact, familiar (function calls)  
**Cons:** Less visual structure, harder to nest

#### Option 4: Simplified Color Syntax

Instead of `[red]text[/]`, consider:

```typescript
// Option A: Single tag with colon
{red: text}              // Red text
{red bold: text}         // Red and bold
{#58F1f0: text}          // Hex color

// Option B: Prefix notation
red(text)                // Red text
red.bold(text)           // Red and bold
hex(#58F1f0, text)       // Hex color

// Option C: Keep BBCode but shorter closing
[red]text[/]             // Current
[red]text[//]            // Shorter closing?
[red:text]               // No closing needed!
```

**Pros:** Less typing, clearer structure  
**Cons:** Different from common patterns

#### Option 5: Hybrid - Minimal XML + Simple Colors

```typescript
// Short tags, no quotes, simple colors
region.set(`<f gap=2>
  <t>Status:</t>
  <t grow=1>{red}Connected{/}</t>
</f>`);
```

**Pros:** Balanced simplicity and readability  
**Cons:** Still has some verbosity

#### Function-Based API (Chosen!)

```typescript
import { flex, col, color } from 'linecraft';

// Plain strings work as columns automatically (auto-wrapped)
region.set(
  flex({ gap: 2 },
    'Status:',  // Auto-wrapped in col({})
    col({ flex: 1 }, color('red', 'Connected'))
  )
);

// Or explicitly use col()
region.set(
  flex({ gap: 2 },
    col({}, 'Status:'),
    col({ flex: 1 }, color('red', 'Connected'))
  )
);
```

**Pros:** 
- Type-safe (full TypeScript support)
- No parsing overhead
- Plain strings work automatically (auto-wrapped in `col()`)
- Full JavaScript power
- Simple and clean
- `col()` for explicit column options
- `color()` function for styling

**This is our chosen approach!**

### Markup Syntax (Simplified)

#### Color Codes - Simplest Options

**Option A: No-closing tags (Recommended)**
```typescript
[red:text]             // Red text - no closing tag needed!
[green:Success]        // Green text
[#58F1f0:Custom color] // Hex color
[red bold:Styled]      // Multiple styles
[bg:red:Background]    // Background color
```

**Option B: Single closing tag**
```typescript
[red]text[/]           // Red text
[green]text[/]         // Green text
[#58F1f0]text[/]       // Hex color
```

**Option C: Curly braces (shorter)**
```typescript
{red:text}             // Red text
{green:Success}        // Green text
{#58F1f0:Custom}       // Hex color
```

**Recommendation:** Option A (`[color:text]`) is simplest - no closing tags, clear structure, easy to parse.

#### Component Tags - Simplified Options

**Option A: No quotes, lowercase (Recommended)**
```typescript
// Self-closing
<progress current=50 total=100 />
<spinner />

// Containers
<flex gap=2>
  <col min=8>Status:</col>
  <col grow>[red:Connected]</col>
</flex>
```

**Option B: Even shorter tags**
```typescript
<f gap=2>
  <col min=8>Status:</col>
  <col grow>[red:Connected]</col>
</f>
```

**Option C: Function-like (no XML)**
```typescript
flex(gap=2,
  col(min=8, "Status:"),
  col(grow, red("Connected"))
)
```

**Recommendation:** Use `<col>` for flex items with `min`/`max` attributes (width is inherent to columns).

#### Component Registration vs Helper Functions

**Two approaches for components:**

**Option A: Helper Functions (Recommended for simple cases)**
```typescript
import { progressBar } from 'linecraft';

// Helper functions return strings - use in template literals
region.set(`<flex>${progressBar({ current: 50, total: 100 })}</flex>`);
```

**Option B: Component Registration (For complex components)**
```typescript
import { registerComponent } from 'linecraft/markup';
import { MyCustomComponent } from './MyComponent';

// Register for use in markup tags
registerComponent('my-component', MyCustomComponent);

// Use in markup
region.set(`<flex><my-component prop=value /></flex>`);
```

**Recommendation:** Use helper functions for simple, data-driven components (progress bars, spinners). Use component registration for complex components with internal state or behavior.

### Core Components

#### Base Component (`src/ts/components/base.ts`)

All components inherit from the `Component` base class. Components can be used both programmatically and via markup:

```typescript
abstract class Component {
  protected region: TerminalRegion;
  protected parent?: Component;
  protected children: Component[] = [];
  protected minWidth: number = 0;
  protected maxWidth: number = Infinity;
  protected flexGrow: number = 0;
  protected flexShrink: number = 1;
  protected width?: number;

  abstract getPreferredWidth(): number;
  abstract render(x: number, y: number, width: number): void;
  abstract getHeight(): number;
  
  // For markup support
  static fromMarkup?(attrs: Record<string, string>, children: Component[]): Component;
}
```

**Features:**
- Parent-child relationships for composition
- Min/max width constraints
- Flex grow/shrink properties
- Markup serialization support

#### Column Component (`src/ts/components/col.ts`)

Flex item wrapper - represents a column/item in flex layout:

```typescript
// In markup - text is implicit, no <text> component needed
<col>Plain text</col>
<col flex=1>[green:Styled text]</col>
<col flex=2 min=8 max=50 ellipsis=end>Long content</col>
```

**Column Properties:**
- `flex` - Flex grow ratio (number, default: 0 = no grow)
- `min` - Minimum width (number, default: content width)
- `max` - Maximum width (number, default: no limit)
- `ellipsis` - Overflow handling: `end`, `start`, `middle`, `wrap`, `none` (default: `end`)

**Behavior:**
- Default width = content width
- Grows proportionally based on `flex` value if space available
- Shrinks if space constrained (respects `min`)
- Truncates if content exceeds `max` (based on `ellipsis` setting)

**Note:** Text is implicit in markup - no `<text>` component needed. The `<col>` component handles text rendering and overflow.

#### Flex Layout (`src/ts/layout/flex.ts`)

Flexbox-like container for arranging columns:

```typescript
// Markup usage
region.set(`<flex gap=2>
  <col>Status:</col>
  <col grow>[green:Connected]</col>
</flex>`);

// Programmatic usage
const flex = new Flex(region, {
  direction: 'row', // or 'column'
  gap: 1,
  justifyContent: 'start', // or 'end', 'center', 'space-between', 'space-around'
  alignItems: 'stretch', // or 'start', 'end', 'center'
});
```

**Layout Algorithm (Flexbox Math):**

1. **Measure base sizes**: Each `<col>` measures its content width
2. **Apply min/max constraints**: 
   - `min`: baseSize = Math.max(baseSize, min)
   - `max`: baseSize = Math.min(baseSize, max)
3. **Calculate available space**:
   - availableSpace = containerWidth - sum(baseSizes) - gaps
4. **Distribute flex space**:
   - Calculate total flex: sum of all `flex` values (default 0)
   - If totalFlex > 0:
     - flexUnit = availableSpace / totalFlex
     - For each col: finalSize = baseSize + (flex * flexUnit)
   - Else: finalSize = baseSize
5. **Apply constraints again** (after flex distribution):
   - finalSize = Math.max(finalSize, min)
   - finalSize = Math.min(finalSize, max)
6. **Handle overflow**: Content that exceeds final width gets truncated (ellipsis)

**Example:**
```typescript
<flex gap=2>  // Container width: 80, gap: 2
  <col flex=1>Short</col>      // base: 5, flex: 1 → final: 5 + (1 * flexUnit)
  <col flex=2>Longer text</col> // base: 11, flex: 2 → final: 11 + (2 * flexUnit)
</flex>
// totalFlex = 3, availableSpace = 80 - 5 - 11 - 2 = 62
// flexUnit = 62 / 3 = 20.67
// col1: 5 + (1 * 20.67) = 25.67 → 26
// col2: 11 + (2 * 20.67) = 52.33 → 52
```

**Column Properties (on `<col>`):**
- `flex` - Flex grow ratio (number, default: 0 = no grow, 1 = grow equally, 2 = grow twice as much, etc.)
- `min` - Minimum width (number, default: content width)
- `max` - Maximum width (number, default: no limit)
- `ellipsis` - Overflow handling: `end`, `start`, `middle`, `wrap` (default: `end`)

**Example:**
```typescript
<flex gap=2>
  <col min=8>Status:</col>           // Fixed width: 8 chars
  <col flex=1 max=50>[green:Connected]</col>  // Grows (flex=1), max 50 chars
  <col>Done</col>                      // Content width only (flex=0)
</flex>

// Flex ratios
<flex>
  <col flex=1>One part</col>    // Gets 1/3 of remaining space
  <col flex=2>Two parts</col>   // Gets 2/3 of remaining space
</flex>
```

### Simple Color Formatting (`src/ts/utils/colors-simple.ts`)

#### Chainable Color API

```typescript
import { c } from 'linecraft/utils/colors-simple';

// Simple usage
c.red('Error message');
c.green.bold('Success!');
c.bold.yellow('Warning');

// All color methods are chainable
c.red.bold.underline('Styled text');
```

#### Pre-defined Colors

```typescript
import { colors } from 'linecraft/utils/colors-simple';

colors.red('Error');
colors.green('Success');
colors.bold('Bold text');
colors.dim('Dim text');
```

#### Custom Color Functions

```typescript
import { colorFn } from 'linecraft/utils/colors-simple';

const error = colorFn('red', { bold: true });
error('This is an error');
```

### Text Utilities (`src/ts/utils/text.ts`)

Text manipulation functions:

```typescript
import { truncateEnd, truncateStart, truncateMiddle, wrapText } from 'linecraft/utils/text';

truncateEnd('Very long text', 10); // 'Very lo...'
truncateStart('Very long text', 10); // '...ng text'
truncateMiddle('Very long text', 10); // 'Very...text'
wrapText('Long text that wraps', 10); // ['Long text', 'that wraps']
```

### ASCII Drawing Primitives (`src/ts/drawing/boxes.ts`)

Drawing utilities for boxes and lines:

```typescript
import { 
  drawRoundedBox, 
  drawSingleBox, 
  drawDoubleBox,
  drawHorizontalLine,
  drawVerticalLine,
  drawDivider
} from 'linecraft/drawing/boxes';

// Rounded box (default)
const box = drawRoundedBox(20, 5);
// Returns: ['╭──────────────────╮', '│                  │', ...]

// Single-line box
const singleBox = drawSingleBox(20, 5);
// Returns: ['┌──────────────────┐', '│                  │', ...]

// Double-line box
const doubleBox = drawDoubleBox(20, 5);
// Returns: ['╔══════════════════╗', '║                  ║', ...]

// Horizontal lines
drawHorizontalLine(10, 'single'); // '──────────'
drawHorizontalLine(10, 'double'); // '══════════'
drawHorizontalLine(10, 'thick');  // '━━━━━━━━━━'
drawHorizontalLine(10, 'dashed'); // '┄┄┄┄┄┄┄┄┄┄'

// Vertical lines
drawVerticalLine(5, 'single'); // ['│', '│', '│', '│', '│']

// Divider with optional left/right characters
drawDivider(20, 'single', '├', '┤'); // '├──────────────────┤'
```

### Usage Examples - Function-Based API

#### Function-Based Approach (Chosen!)

```typescript
import { createRegion, flex, col, color, progressBar } from 'linecraft';

const region = createRegion();

// Simple text
region.set('Hello World');

// Text with colors
region.set(color('red', 'Error: Something went wrong'));

// Flex layout - plain strings work automatically!
region.set(
  flex({ gap: 2 },
    'Status:',  // Auto-wrapped in col({})
    col({ flex: 1 }, color('green', 'Connected'))
  )
);

// Flex ratios
region.set(
  flex({ gap: 1 },
    col({ flex: 1 }, 'One part'),
    col({ flex: 2 }, 'Two parts')
  )
);

// Progress bar
region.set(
  flex({ gap: 2 },
    'Progress',
    col({ flex: 1 }, color('green', progressBar({ current: 50, total: 100 })))
  )
);

// Reactive updates - just call region.set() again!
for (let i = 0; i <= 100; i++) {
  region.set(
    flex({ gap: 2 },
      'Progress',
      col({ flex: 1 }, color('green', progressBar({ current: i, total: 100 })))
    )
  );
  await sleep(50);
}
```

**Key Features:**
- **Function-based API** - `flex()`, `col()` functions instead of markup
- **Plain strings work** - Auto-wrapped in `col({})` when passed to `flex()`
- **Color function** - `color('red', text)` for styling
- **Type-safe** - Full TypeScript support
- **No parsing** - Direct function calls, no string parsing overhead
- **Flex ratios** - `flex: 1`, `flex: 2` for proportional sizing
- **Width constraints** - `min`, `max` options on `col()`
- **Reactive by default** - Just call `region.set()` again, diffing handles updates

#### Programmatic API (Still Available)

```typescript
import { createRegion } from 'linecraft';
import { Flex } from 'linecraft/layout/flex';
import { Text } from 'linecraft/components/text';

const region = createRegion();

// Create components programmatically
const container = new Flex(region, {
  direction: 'row',
  gap: 2,
});

const label = new Text(region, 'Status:', {
  minWidth: 8,
  maxWidth: 8,
});

container.addChild(label);
container.render(0, 0, 80);
```

**Both approaches work!** Use markup for simple, declarative UIs, or the programmatic API for dynamic, complex logic.

### Markup Parser (`src/ts/markup/`)

The markup parser is lightweight and fast. It handles both static markup and template literal interpolation:

```typescript
// src/ts/markup/parser.ts
export function parseMarkup(
  markup: string, 
  region: TerminalRegion,
  componentRegistry: ComponentRegistry
): Component {
  // Simple recursive descent parser
  // Handles:
  // - Component tags: <flex>, <col>, etc.
  // - Self-closing tags: <progress />
  // - Attributes: min=10, max=50 (no quotes, width is inherent)
  // - Color codes: [red:text] (no closing tag)
  // - Template literal interpolation: ${progressBar({...})}
  //   (handled by JS before parsing - parser sees final string)
}
```

**Parser Features:**
- Fast, single-pass parsing
- No external dependencies
- Handles nested components
- Supports both attributes and color codes
- Template literal functions are evaluated first, then parsed
- Error messages point to problematic markup

**How Reactivity Works:**

The key insight: **You don't need a reactive system!** Just call `region.set()` again:

```typescript
// Initial render
region.set(`<flex>${progressBar({ percent: 10 })}</flex>`);

// Update - just call set() again with new values
region.set(`<flex>${progressBar({ percent: 20 })}</flex>`);

// The diffing system automatically:
// 1. Compares new content vs previous frame
// 2. Only updates lines that changed
// 3. Throttles updates (60 FPS by default)
// 4. Batches writes for performance
```

**Helper Functions:**

Helper functions return strings (not component instances) for use in template literals:

```typescript
// Helper functions (return strings)
export function progressBar(options: { current: number; total: number; label?: string }): string {
  const percent = (options.current / options.total) * 100;
  const filled = Math.floor((percent / 100) * 40);
  const bar = '█'.repeat(filled) + '░'.repeat(40 - filled);
  return `${options.label || ''} [${bar}] ${percent.toFixed(1)}%`;
}

export function spinner(text?: string): string {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  // For static use, return first frame
  // For animated, use the component API
  return `${frames[0]} ${text || ''}`;
}
```

**Usage Pattern:**

```typescript
// In your update loop
let percent = 0;
const interval = setInterval(() => {
  percent += 1;
  region.set(`<flex gap=2>
    <col>[bold:Progress:]</col>
    <col grow>${progressBar({ current: percent, total: 100, label: 'Installing' })}</col>
  </flex>`);
  
  if (percent >= 100) {
    clearInterval(interval);
  }
}, 50);
```

### Project Structure Updates

```
src/ts/
├── components/
│   ├── base.ts              # Base component class
│   ├── col.ts                # Column component (flex item wrapper)
│   ├── progress-bar.ts      # Existing progress bar
│   └── spinner.ts           # Existing spinner
├── layout/
│   └── flex.ts              # Flexbox-like layout
├── markup/                  # Markup DSL system
│   ├── parser.ts            # Markup parser
│   ├── registry.ts           # Component registry
│   └── colors.ts             # Color code parsing
├── drawing/
│   └── boxes.ts              # ASCII drawing primitives
└── utils/
    ├── colors.ts             # Existing color utilities
    ├── colors-simple.ts      # Simple color API
    └── text.ts               # Text manipulation utilities
```

**Note:** No `<text>` component - text is implicit in markup. The `<col>` component handles text rendering and overflow.

## Markup DSL Design Decisions

### Why Markup Instead of Just Programmatic API?

1. **Declarative**: Easier to read and write for simple UIs
2. **Template-friendly**: Works great with template literals
3. **Less boilerplate**: No need to create objects for every component
4. **Familiar**: Similar to HTML/JSX, which many developers know

### Why Keep Programmatic API?

1. **Dynamic logic**: Better for complex, conditional rendering
2. **Type safety**: Full TypeScript support
3. **Performance**: Direct method calls, no parsing overhead
4. **Flexibility**: Can mix both approaches

### Simplicity Constraints

To keep the system simple, we intentionally **don't** support:
- Complex expressions in attributes (only strings/numbers)
- JavaScript in markup (use programmatic API instead)
- Full HTML/CSS compatibility (terminal-specific)
- Closing tags for colors (use `[color:text]` syntax)
- Full XML namespace support
- Nested quotes in attributes

### Syntax Simplification Decisions

**Chosen simplifications:**
1. ✅ **No closing tags for colors**: `[red:text]` (text can only be one color)
2. ✅ **No quotes for attributes**: `gap=2` instead of `gap="2"`
3. ✅ **Flex ratios**: `flex=1`, `flex=2` instead of boolean `grow` (like CSS flex-grow)
4. ✅ **Short attribute names**: `min`/`max` instead of `min-width`/`max-width` (width is inherent to columns)
5. ✅ **Lowercase tags**: `<flex>`, `<col>` instead of `<Flex>`, `<Col>`
6. ✅ **Self-closing shorthand**: `<progress />` for components with no children
7. ✅ **Line breaks**: `<br>` support
8. ✅ **No `<text>` component**: Text is implicit in markup - use `<col>` for flex items
9. ✅ **Full flexbox math**: Proper flex-grow distribution with min/max constraints

**Rejected simplifications (too complex or unclear):**
- ❌ Single-letter tags (`<f>`, `<t>`) - too cryptic
- ❌ Function syntax - loses visual structure
- ❌ Curly braces for colors - conflicts with template literals
- ❌ Separate `<text>` component - text is implicit, `<col>` handles it

### Color Code Design

Using BBCode-style `[color]` instead of HTML `<span>` because:
- Shorter syntax
- Easier to type
- Less visual noise
- Familiar to many developers (forums, Discord, etc.)

## Future Enhancements

1. **More Components**
   - Box component (wraps drawing primitives)
   - Table component
   - Tree component
   - Form components
   - Charts (ASCII)

2. **Markup Enhancements**
   - CSS-like style attributes: `style="color: red; bold: true"`
   - Template variables: `<Text>{status}</Text>`
   - Conditional rendering: `<If condition="true">...</If>`
   - Loops: `<For each="item in items">...</For>`

3. **Advanced Features**
   - Mouse support
   - Keyboard input handling
   - Window resizing detection (already implemented)
   - Terminal detection (capabilities)

4. **Layout Enhancements**
   - Grid layout system
   - Absolute positioning
   - Z-index/layering
   - Padding and margins

5. **Optimizations**
   - Markup parsing cache
   - Component-level caching
   - More aggressive buffering
   - Adaptive throttling

6. **Developer Experience**
   - Better error messages (point to markup location)
   - Debug mode (show diff operations)
   - Performance profiling tools
   - Component inspector
   - Syntax highlighting for markup

## License

MIT License - see LICENSE file

## Dependencies

### Zig
- Standard library only (no external deps)

### Node.js
- TypeScript (dev)
- @types/node (dev)
- Build tools (dev)

