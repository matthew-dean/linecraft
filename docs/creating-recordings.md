# Creating Terminal Recordings with vhs

This guide explains how to create animated GIF recordings of terminal examples using [vhs](https://github.com/charmbracelet/vhs).

## Installation

**⚠️ You must install vhs before using the recording scripts!**

**Install vhs:**
```bash
# macOS (recommended)
brew install vhs

# Linux (download binary)
# Visit https://github.com/charmbracelet/vhs/releases

# Or via Go
go install github.com/charmbracelet/vhs@latest
```

Verify installation:
```bash
vhs --version
```

## Quick Start

All tape files are pre-configured in `docs/examples/`. To record a specific example:

```bash
# Record a single example
pnpm record docs/examples/styled.tape

# Or use vhs directly
vhs docs/examples/styled.tape
```

To record all examples:
```bash
pnpm record:all
```

## Basic Usage

1. **Create a `.tape` file** (e.g., `docs/examples/styled.tape`):
   ```tape
   Output docs/examples/styled.gif
   Set FontSize 14
   Set Width 1000
   Set Height 600
   Set Theme "Catppuccin Mocha"
   
   Type "pnpm example styled"
   Enter
   Sleep 3s
   ```

2. **Run vhs:**
   ```bash
   vhs docs/examples/styled.tape
   ```

3. **The GIF will be generated** at `docs/examples/styled.gif`

## vhs Features

- ✅ Direct GIF output (no conversion needed)
- ✅ Scriptable recordings (`.tape` files)
- ✅ Customizable themes, fonts, and sizes
- ✅ Precise timing control
- ✅ Works great with interactive terminal UIs

## Example `.tape` Files

### Simple Component Demo
```tape
Output docs/examples/styled.gif
Set FontSize 14
Set Width 1000
Set Height 600
Set Theme "Catppuccin Mocha"
Set Padding 20

Type "pnpm example styled"
Enter
Sleep 3s
```

### Interactive Demo (with prompts)
```tape
Output docs/examples/code-debug.gif
Set FontSize 14
Set Width 1200
Set Height 800
Set Theme "Catppuccin Mocha"
Set Padding 20

Type "pnpm example code-debug"
Enter
Sleep 2s
Type " "
Sleep 1s
Type " "
Sleep 1s
Type " "
Sleep 1s
```

### Progress Bar Demo
```tape
Output docs/examples/progressbar.gif
Set FontSize 14
Set Width 1000
Set Height 400
Set Theme "Catppuccin Mocha"
Set Padding 20

Type "pnpm example basic-progress"
Enter
Sleep 5s
```

### Spinner Demo
```tape
Output docs/examples/spinner.gif
Set FontSize 14
Set Width 800
Set Height 400
Set Theme "Catppuccin Mocha"
Set Padding 20

Type "pnpm example spinner"
Enter
Sleep 4s
```

## Common vhs Commands

- `Output <path>` - Set output GIF path
- `Set FontSize <size>` - Set font size (default: 14)
- `Set Width <pixels>` - Set terminal width
- `Set Height <pixels>` - Set terminal height
- `Set Theme "<name>"` - Set color theme (e.g., "Catppuccin Mocha", "Dracula")
- `Set Padding <pixels>` - Set padding around terminal
- `Type "<text>"` - Type text
- `Enter` - Press Enter
- `Sleep <duration>` - Wait (e.g., "2s", "500ms")
- `Ctrl+C` - Send Ctrl+C
- `Space` - Press spacebar
- `Backspace` - Press backspace
- `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` - Arrow keys

## Recording Responsive Behavior

To record demos that show responsive behavior (like terminal resizing), you have two options:

### Option 1: Manual Recording (Recommended for Responsive Demos)

For demos that respond to terminal resizing, use `vhs record` to capture your actual terminal interactions:

```bash
# Start recording
vhs record > docs/examples/reactive-resize.tape

# Run your demo
pnpm example reactive-resize

# Resize your terminal window manually to show responsiveness
# Press Ctrl+C or type 'exit' when done

# Generate GIF
vhs docs/examples/reactive-resize.tape
```

This captures the actual resize events and terminal responses.

### Option 2: Scripted Resize (If Supported)

Some versions of vhs may support changing dimensions mid-recording:

```tape
Set Width 600
# ... run demo ...
Set Width 900  # Change width
Sleep 1s
Set Width 400  # Change again
```

**Note**: This may not work in all vhs versions. Test first or use Option 1.

## Tips

1. **Adjust timing**: Use `Sleep` commands to give enough time for animations to complete
2. **Set appropriate dimensions**: Match width/height to your terminal size for best results
3. **Use themes**: Popular themes include "Nord", "Catppuccin Mocha", "Dracula", "One Dark"
4. **Test interactively**: Run the example manually first to understand timing
5. **Padding**: Add padding for better visual appearance in the GIF
6. **Responsive demos**: Use `vhs record` for demos that need actual terminal resizing

## Resources

- [vhs GitHub](https://github.com/charmbracelet/vhs)
- [vhs Documentation](https://github.com/charmbracelet/vhs#readme)
- [Available Themes](https://github.com/charmbracelet/vhs#themes)

