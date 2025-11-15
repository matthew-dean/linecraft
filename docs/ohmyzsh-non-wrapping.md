# How OhMyZsh Prevents Terminal Auto-Wrapping

## The Problem

By default, terminals automatically wrap text to the next line when it exceeds the terminal width. This makes it difficult to create right-pinned elements (like status indicators) because:

1. Content wraps unexpectedly when terminal resizes
2. Hard to predict where content will be
3. Updates require handling wrapped content across multiple lines

## OhMyZsh's Solution

OhMyZsh uses ANSI escape codes to **temporarily disable auto-wrap** when writing right-pinned content.

### The ANSI Escape Codes

- **Disable auto-wrap**: `\x1b[?7l` (DECAWM off)
  - Equivalent to shell command: `tput rmam` (reset mode automatic margins)
  
- **Enable auto-wrap**: `\x1b[?7h` (DECAWM on)
  - Equivalent to shell command: `tput smam` (set mode automatic margins)

### How It Works

```bash
# OhMyZsh right prompt example
# 1. Disable auto-wrap
echo -ne '\x1b[?7l'
# 2. Move cursor to right side (absolute positioning)
echo -ne '\x1b[1;80H'  # Row 1, Column 80
# 3. Write right-pinned content
echo -ne 'git:main'
# 4. Re-enable auto-wrap (IMPORTANT!)
echo -ne '\x1b[?7h'
```

### What Happens

1. **With auto-wrap disabled**:
   - Text that exceeds terminal width is **cut off** (doesn't wrap)
   - Content stays at a **fixed column position**
   - When terminal resizes, content doesn't automatically reflow

2. **Benefits**:
   - Predictable positioning (always at column X)
   - Easier updates (just overwrite the same position)
   - No need to handle wrapped content

3. **Trade-offs**:
   - Content can go off-screen if terminal is too narrow
   - Must manually handle resize events
   - Must remember to re-enable auto-wrap

### Example: Right-Pinned Status

```typescript
// Write a right-pinned status that won't wrap
function writeRightPinnedStatus(text: string, row: number, terminalWidth: number) {
  // 1. Disable auto-wrap
  process.stdout.write('\x1b[?7l');
  
  // 2. Move to right side
  const col = terminalWidth - text.length;
  process.stdout.write(`\x1b[${row};${col}H`);
  
  // 3. Write content
  process.stdout.write(text);
  
  // 4. Re-enable auto-wrap (CRITICAL!)
  process.stdout.write('\x1b[?7h');
}
```

### Why This Helps with Resize

When the terminal resizes:
- Content written with auto-wrap disabled **doesn't automatically reflow**
- It stays at its original column position
- The application must **manually update** it (which is easier than handling wrapped content)

This is why OhMyZsh's right prompt doesn't wrap - it's written with auto-wrap disabled, so it just gets cut off or goes off-screen if the terminal is too narrow.

## Implementation in linecraft

We can add support for this by:

1. ✅ Adding `DISABLE_AUTO_WRAP` and `ENABLE_AUTO_WRAP` constants (done)
2. Adding a `noWrap` option to `col()` component
3. Using absolute positioning for right-pinned elements
4. Ensuring we always re-enable auto-wrap after writing

This will allow users to create right-pinned elements that behave like OhMyZsh prompts - they don't wrap, making updates much simpler.

