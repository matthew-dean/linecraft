# Linecraft

> **Beautiful, high-performance terminal UI library for Node.js** 🎨

Linecraft makes it easy to build stunning terminal interfaces with components, layouts, and responsive design. Create progress bars, spinners, code debuggers, and more with a clean, component-based API.

## ✨ Features

- 🎯 **Component-based** - Build UIs with reusable components
- 📐 **Responsive layouts** - Automatic resizing and reflow
- 🎨 **Beautiful styling** - Colors, borders, and typography
- ⚡ **High performance** - Efficient diffing and minimal terminal updates
- 🔧 **Type-safe** - Full TypeScript support
- 🎭 **Flexible** - Works with any terminal that supports ANSI codes

## 📦 Installation

```bash
npm install linecraft
# or
pnpm add linecraft
# or
yarn add linecraft
```

## 🚀 Quick Start

```typescript
import { Region, Styled, Spinner } from 'linecraft';

const r = Region();

// Add styled text
r.set(Styled({ color: 'brightCyan', bold: true }, 'Hello, Linecraft!'));

// Add a spinner
const spinner = r.add(Spinner({ frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] }));
await new Promise(resolve => setTimeout(resolve, 2000));
spinner.delete();

r.destroy();
```

## 📚 Core API

### Creating a Region

A `Region` is a managed area of the terminal that handles rendering, resizing, and component lifecycle.

```typescript
import { Region } from 'linecraft';

const r = Region({
  width: 80,        // Optional: auto-detects terminal width
  height: 1,        // Optional: expands as needed
  debugLog: 'debug.log' // Optional: log rendering operations
});
```

### Setting Content

Use `set()` to replace all content, or `add()` to append:

```typescript
// Replace all content
r.set('Hello, world!');

// Append content
r.add('Line 1');
r.add('Line 2');

// Add components
r.set(MyComponent());
const ref = r.add(AnotherComponent());
ref.delete(); // Remove later
```

### Flushing and Cleanup

```typescript
await r.flush(); // Ensure all pending renders complete
r.destroy();     // Clean up and restore terminal
```

## 🧩 Built-in Components

### Styled

Apply colors, bold, italic, and more to text:

```typescript
import { Styled } from 'linecraft';

r.set(Styled({ 
  color: 'brightGreen', 
  bold: true,
  backgroundColor: 'black'
}, 'Bold green text on black'));
```

**Options:**
- `color?: Color` - Text color
- `backgroundColor?: Color` - Background color
- `bold?: boolean` - Bold text
- `italic?: boolean` - Italic text
- `underline?: boolean` - Underlined text
- `overflow?: 'none' | 'ellipsis-end' | 'ellipsis-start' | 'ellipsis-middle' | 'wrap'` - Text overflow handling
- `align?: 'left' | 'right' | 'center'` - Text alignment

### Section

Wrap content in a beautiful bordered box with optional title:

```typescript
import { Section } from 'linecraft';

r.set(Section(
  {
    title: 'My Section',
    titleColor: 'brightCyan',
    borderColor: 'brightBlack',
    padding: 1,
    left: true,
    right: true,
    top: true,
    bottom: true
  },
  'Content goes here'
));
```

**Options:**
- `title?: string` - Title shown in a tab at the top
- `titleColor?: Color` - Color of the title
- `borderColor?: Color` - Color of borders
- `padding?: number` - Internal padding (default: 1)
- `left?: boolean` - Show left border (default: true)
- `right?: boolean` - Show right border (default: true)
- `top?: boolean` - Show top border (default: true)
- `bottom?: boolean` - Show bottom border (default: true)

### CodeDebug

Display code errors and warnings with beautiful formatting, line numbers, and context:

```typescript
import { CodeDebug } from 'linecraft';

r.set(CodeDebug({
  startLine: 42,
  startColumn: 10,
  endLine: 42,
  endColumn: 20,
  errorLine: '    const result = fetchData();',
  lineBefore: '  async function load() {',
  lineAfter: '    return process(result);',
  message: 'Type error: fetchData is not defined',
  filePath: 'src/loaders/data.ts',
  fullPath: '/absolute/path/to/src/loaders/data.ts',
  baseDir: process.cwd(),
  type: 'error', // 'error' | 'warning' | 'info'
  maxColumn: 100 // Optional: force truncation before this column
}));
```

**Features:**
- Automatic line number coloring (adapts to dark/light terminals)
- Responsive truncation with ellipsis
- Curved underlines for error ranges
- Message wrapping
- Clickable file paths (OSC 8 links)
- Context lines (before/after)

### Spinner

Animated spinner for loading states:

```typescript
import { Spinner } from 'linecraft';

const spinner = r.add(Spinner({
  frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  interval: 80
}));

// Later...
spinner.stop();
spinner.delete();
```

**Options:**
- `frames?: string[]` - Array of characters to cycle through
- `interval?: number` - Milliseconds between frames (default: 100)

### ProgressBar

Beautiful progress bars with labels:

```typescript
import { progressBar } from 'linecraft';

r.set(progressBar({
  current: 75,
  total: 100,
  label: 'Processing',
  width: 50,
  style: {
    complete: '█',
    incomplete: '░',
    brackets: ['[', ']']
  }
}));
```

### Segments

Create segmented displays (like oh-my-zsh style prompts):

```typescript
import { Segments } from 'linecraft';

r.set(Segments({
  segments: [
    { text: 'user@host', color: 'brightGreen', backgroundColor: 'blue' },
    { text: '~/projects', color: 'white', backgroundColor: 'brightBlue' },
    { text: 'main', color: 'black', backgroundColor: 'white' }
  ],
  separator: { char: '▶', color: 'blue' },
  style: 'round'
}));
```

### Fill

Fill available space with a character:

```typescript
import { fill } from 'linecraft';

r.set(fill({ char: '─', color: 'brightBlack' }));
```

### Grid

Create responsive grid layouts:

```typescript
import { Grid } from 'linecraft';

r.set(Grid({
  columns: [
    { width: 'auto' },
    { width: '1fr' },
    { width: 'auto' }
  ],
  gap: 1,
  children: [
    Styled({ color: 'red' }, 'Left'),
    Styled({ color: 'green' }, 'Center'),
    Styled({ color: 'blue' }, 'Right')
  ]
}));
```

## 🎯 Advanced Usage

### Prompt Utility

Wait for user input:

```typescript
import { prompt } from 'linecraft';

await prompt(r, {
  message: 'continue',
  key: 'spacebar', // 'spacebar' | 'enter' | 'q' | 'any'
  color: 'brightBlack'
});
```

### Custom Components

Components are just functions that return strings or arrays:

```typescript
function MyComponent(): Component {
  return (ctx: RenderContext) => {
    return `Hello! Width: ${ctx.availableWidth}`;
  };
}

r.set(MyComponent());
```

### Responsive Behavior

Regions automatically re-render on terminal resize. Components receive updated widths and reflow accordingly:

```typescript
// This component will automatically re-render when terminal resizes
r.set(Styled({ overflow: 'wrap' }, longText));
```

## 🎨 Colors

Available colors:
- `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`
- `brightBlack`, `brightRed`, `brightGreen`, `brightYellow`, `brightBlue`, `brightMagenta`, `brightCyan`, `brightWhite`

## 📖 Examples

Check out the `examples/` directory for more examples:

- `basic-progress.ts` - Progress bars
- `spinner.ts` - Animated spinners
- `code-debug.ts` - Code error display
- `grid-*.ts` - Grid layout examples
- `segments.ts` - Segmented displays

Run examples with:
```bash
pnpm example <name>
```

## 🔧 API Reference

### Region Methods

- `set(content)` - Replace all content
- `add(content)` - Append content, returns `SectionReference` or `ComponentReference`
- `setLine(lineNumber, content)` - Set a specific line
- `flush()` - Ensure all renders complete
- `destroy(clearFirst?)` - Clean up and restore terminal
- `get width` - Current region width
- `get height` - Current region height

### Component Reference

- `delete()` - Remove the component from the region

### Section Reference

- `update(content)` - Update the section content
- `delete()` - Remove the section from the region

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📄 License

MIT

---

**Made with ❤️ for beautiful terminal UIs**
