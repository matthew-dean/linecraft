# Unicode Block and Line Characters - Font Compatibility Guide

This document lists Unicode block and line drawing characters that are widely supported across different terminal fonts.

## Block Elements (U+2580-U+259F)

These are the most widely supported block characters:

### Half Blocks (Most Compatible)
- `▐` (U+2590) - **Right half block** - Fills right half of character cell
- `▌` (U+258C) - **Left half block** - Fills left half of character cell
- `▄` (U+2584) - **Lower half block** - Fills bottom half
- `▀` (U+2580) - **Upper half block** - Fills top half

### Quarter Blocks
- `▖` (U+2596) - **Lower left quadrant** - May not be in all fonts
- `▗` (U+2597) - **Lower right quadrant** - May not be in all fonts
- `▘` (U+2598) - **Upper left quadrant** - May not be in all fonts
- `▝` (U+259D) - **Upper right quadrant** - May not be in all fonts

### Three-Quarter Blocks
- `▙` (U+2599) - **Lower three-quarters block** - Less common
- `▛` (U+259B) - **Upper three-quarters block** - Less common
- `▜` (U+259C) - **Left three-quarters block** - Less common
- `▟` (U+259F) - **Right three-quarters block** - Less common

### Full and Shaded Blocks
- `█` (U+2588) - **Full block** - Very widely supported
- `▓` (U+2593) - **Dark shade** - Widely supported
- `▒` (U+2592) - **Medium shade** - Widely supported
- `░` (U+2591) - **Light shade** - Widely supported

## Box Drawing Characters (U+2500-U+257F)

These are extremely widely supported (part of the original ASCII/ANSI standard):

### Horizontal Lines
- `─` (U+2500) - **Single horizontal line**
- `═` (U+2550) - **Double horizontal line**
- `━` (U+2501) - **Heavy horizontal line**

### Vertical Lines
- `│` (U+2502) - **Single vertical line**
- `║` (U+2551) - **Double vertical line**
- `┃` (U+2503) - **Heavy vertical line**

### Corners
- `┌` (U+250C) - **Top-left corner**
- `┐` (U+2510) - **Top-right corner**
- `└` (U+2514) - **Bottom-left corner**
- `┘` (U+2518) - **Bottom-right corner**

### Rounded Corners
- `╭` (U+256D) - **Rounded top-left**
- `╮` (U+256E) - **Rounded top-right**
- `╰` (U+2570) - **Rounded bottom-left**
- `╯` (U+256F) - **Rounded bottom-right**

### T-Junctions
- `├` (U+251C) - **Left T-junction**
- `┤` (U+2524) - **Right T-junction**
- `┬` (U+252C) - **Top T-junction**
- `┴` (U+2534) - **Bottom T-junction**

### Crosses
- `┼` (U+253C) - **Four-way junction**

### Diagonal Lines
- `╱` (U+2571) - **Forward slash** - Good support
- `╲` (U+2572) - **Backslash** - Good support
- `╳` (U+2573) - **Cross diagonal**

## Recommendations for Segments Component

### Most Compatible (Recommended)
1. **Half blocks**: `▐` (right) and `▌` (left) - Best for overlap effect
2. **Vertical line**: `│` - Simple separator
3. **Full block**: `█` - Solid fill

### Good Alternatives
1. **Shaded blocks**: `▓`, `▒`, `░` - For gradient effects
2. **Diagonal lines**: `╱`, `╲` - For angled dividers
3. **Box corners**: `┌`, `┐`, `└`, `┘` - For boxed segments

### Avoid (Font-Dependent)
- Quarter blocks (`▖`, `▗`, `▘`, `▝`) - Not in all fonts
- Three-quarter blocks (`▙`, `▛`, `▜`, `▟`) - Not in all fonts
- Powerline characters (U+E0B0, U+E0B2) - Require special fonts

## Testing Font Support

To test which characters your terminal supports, you can run:

```bash
# Test block elements
echo "Half blocks: ▐ ▌ ▄ ▀"
echo "Full block: █"
echo "Shades: ▓ ▒ ░"

# Test box drawing
echo "Lines: │ ─ ╱ ╲"
echo "Corners: ┌ ┐ └ ┘"
```

