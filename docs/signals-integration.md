# Signals Integration Plan

## Goal
Integrate `@preact/signals-core` for reactivity **optionally**. Keep simple cases simple - no signals required.

## Core Principle
**Simple components stay simple. Signals are a power-user feature.**

## Current Pattern (Stays the Same)
```typescript
type Component = (ctx: RenderContext) => string | string[] | null;

// Simple component - no signals needed
const progressBar = (options: ProgressBarOptions): Component => {
  return (ctx: RenderContext) => {
    const percent = (options.current / options.total) * 100;
    return `[${'='.repeat(percent)}]`;
  };
};

// Simple usage - just call region.set() when you want to update
region.set(grid({}, progressBar({ current: 50, total: 100 })));
```

**This stays exactly the same!** No changes required for simple cases.

## Optional Signals (Power User Feature)

### Simple Helper for Signal Values
```typescript
// Helper to unwrap signals or return plain values
function unwrap<T>(value: T | Signal<T>): T {
  return typeof value === 'object' && value !== null && 'value' in value
    ? value.value
    : value;
}

// Component works with both signals and plain values
const progressBar = (options: {
  current: number | Signal<number>;
  total: number | Signal<number>;
}): Component => {
  return (ctx: RenderContext) => {
    // Simple unwrap - works with both
    const currentVal = unwrap(options.current);
    const totalVal = unwrap(options.total);
    
    const percent = (currentVal / totalVal) * 100;
    return `[${'='.repeat(percent)}]`;
  };
};
```

### Usage Examples

**Simple (no signals):**
```typescript
// Plain values - works exactly as before
region.set(grid({}, progressBar({ current: 50, total: 100 })));
```

**With signals (optional):**
```typescript
import { signal } from '@preact/signals-core';

// Create signals
const current = signal(0);
const total = signal(100);

// Use signals - component automatically unwraps
region.set(grid({}, progressBar({ current, total })));

// Update signal - region automatically re-renders (if tracking enabled)
current.value = 50;
```

## Implementation Strategy

### 1. Zero Changes for Simple Cases
- Components work with plain values (no changes)
- No signal dependency required for basic usage
- `@preact/signals-core` is an optional peer dependency

### 2. Signal Detection (Optional)
- During render, detect if any signals are read
- If signals detected, track dependencies
- If no signals, render normally (zero overhead)

### 3. Automatic Re-rendering (Optional)
- Only enabled if signals are detected
- Region tracks signal → component dependencies
- When signal changes, re-render affected components

### 4. Helper Functions
```typescript
// Simple unwrap helper (no signal dependency)
export function unwrap<T>(value: T | Signal<T>): T {
  // Type guard for signals
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return value.value;
  }
  return value as T;
}

// Optional: signal creation helper (requires @preact/signals-core)
export function createSignal<T>(value: T): Signal<T> {
  // Re-export from @preact/signals-core if available
  // Or provide fallback that just returns the value
}
```

## Benefits
- ✅ **Simple cases stay simple** - no signals required
- ✅ **Zero overhead** - signals only add cost when used
- ✅ **Progressive enhancement** - add signals when you need reactivity
- ✅ **Familiar API** - signals work like Preact signals
- ✅ **Type-safe** - TypeScript handles signal vs plain value

## Example: Simple vs Reactive

**Simple (most common):**
```typescript
// Just update when needed
for (let i = 0; i <= 100; i++) {
  region.set(grid({}, progressBar({ current: i, total: 100 })));
  await sleep(50);
}
```

**Reactive (when you want automatic updates):**
```typescript
import { signal } from '@preact/signals-core';

const progress = signal(0);
region.set(grid({}, progressBar({ current: progress, total: 100 })));

// Update automatically triggers re-render
for (let i = 0; i <= 100; i++) {
  progress.value = i;
  await sleep(50);
}
```

Both work! Use what fits your use case.

