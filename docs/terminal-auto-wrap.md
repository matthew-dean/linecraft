# Terminal Auto-Wrap and Non-Wrapping Content

## How OhMyZsh Prevents Wrapping

OhMyZsh (and similar shells) prevent terminal auto-wrapping using ANSI escape codes to control the terminal's auto-wrap mode.

### The Problem

By default, terminals automatically wrap text to the next line when it exceeds the terminal width. This is controlled by the terminal's **DECAWM** (DEC Auto Wrap Mode) setting.

### The Solution: Disable Auto-Wrap

OhMyZsh uses ANSI escape codes to temporarily disable auto-wrap:

- **Disable auto-wrap**: `\x1b[?7l` (DECAWM off)
- **Enable auto-wrap**: `\x1b[?7h` (DECAWM on)

### How It Works

1. **Before writing right-pinned content**:
   - Disable auto-wrap: `\x1b[?7l`
   - Move cursor to the right side: `\x1b[<row>;<col>H` (absolute positioning)
   - Write the content
   - Re-enable auto-wrap: `\x1b[?7h`

2. **When terminal resizes**:
   - The content that was written with auto-wrap disabled stays in place
   - It doesn't automatically reflow/wrap
   - The application must manually update it

### Example

```bash
# OhMyZsh right prompt example
# 1. Disable auto-wrap
echo -ne '\x1b[?7l'
# 2. Move to right side (column 80, row 1)
echo -ne '\x1b[1;80H'
# 3. Write right-pinned content
echo -ne 'git:main'
# 4. Re-enable auto-wrap
echo -ne '\x1b[?7h'
```

### Why This Helps

1. **Predictable positioning**: Content stays at a fixed column position
2. **No reflow complexity**: When terminal resizes, content doesn't automatically wrap
3. **Easier updates**: You can overwrite the exact same position without worrying about wrapped content

### Implementation in linecraft

We can add support for non-wrapping content by:

1. **Adding ANSI escape codes** to disable/enable auto-wrap
2. **Adding a `noWrap` option** to `col()` component
3. **Using absolute positioning** for right-pinned elements
4. **Ensuring we re-enable auto-wrap** after writing

### Trade-offs

**Pros:**
- Content doesn't wrap unexpectedly
- Easier to update (just overwrite the same position)
- Predictable layout

**Cons:**
- Content can go off-screen if terminal is too narrow
- Must manually handle resize events
- Need to be careful to re-enable auto-wrap

