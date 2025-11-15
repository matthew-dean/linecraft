# Linecraft

High-performance terminal UI library for Node.js with Zig backend.

Linecraft provides a friendly TypeScript API while leveraging Zig's speed and efficiency for terminal operations like diffing, ANSI cursor movement, buffering, and throttling.

## Features

- **High Performance**: Zig backend handles all performance-critical operations
- **Automatic Batching**: Updates are automatically batched and throttled
- **Dynamic Regions**: Regions expand automatically as you add lines
- **Simple API**: Clean, intuitive TypeScript interface
- **Components**: Built-in progress bars and spinners

## Installation

```bash
pnpm install linecraft
```

**Note for pnpm users:** Linecraft uses native dependencies (`ffi-napi`, `ref-napi`) that require build scripts. When installing, pnpm will prompt you to approve these build scripts. You can approve them by running:

```bash
pnpm approve-builds ffi-napi ref-napi
```

Then reinstall:

```bash
pnpm install
```

**Node.js Compatibility:** Linecraft requires Node.js 18-23. Node.js 24+ is not yet supported due to compatibility issues with `ffi-napi`.

## Quick Start

### Basic Progress Bar

```typescript
import { createRegion, createProgressBar } from 'linecraft';

const region = createRegion({ width: 80 });
const progress = createProgressBar(region, 1, {
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

### Spinner

```typescript
import { createRegion, createSpinner } from 'linecraft';

const region = createRegion({ width: 80 });
const spinner = createSpinner(region, 1);

spinner.setText('Processing...');
spinner.start();

// Do work...
await doWork();

spinner.stop();
region.destroy();
```

### Custom Layout

```typescript
import { createRegion } from 'linecraft';

const region = createRegion({ width: 80 });

// Set individual lines (1-based)
region.setLine(1, { text: 'Status:', style: { bold: true } });
region.setLine(2, '  ✓ Connected');
region.setLine(3, '  ⏳ Processing...');

// Or set entire content at once
region.set(`Status:
  ✓ Connected
  ⏳ Processing...
  ✗ Error`);
```

## API

### `createRegion(options?)`

Creates a new terminal region.

**Options:**
- `x?: number` - X position (default: 0)
- `y?: number` - Y position (default: 0)
- `width?: number` - Width (default: terminal width)
- `height?: number` - Initial height (default: 1, expands as needed)

### `region.setLine(lineNumber, content)`

Set a single line (1-based). Region expands automatically if needed.

### `region.set(content)`

Set entire content. Can be a string with `\n` separators or an array of `LineContent`.

### `region.flush()`

Force immediate render of pending updates (bypasses throttle).

### `region.setThrottle(fps)`

Set maximum render rate (default: 60 FPS).

## License

MIT

