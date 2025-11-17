# Resize Bug Tracking

## Problem
When terminal is resized, content duplicates/renders incorrectly.

## Attempted Fixes

### 1. Invalidate cursor position on resize
- **What**: Set `savedCursorPosition = false` and `lastRenderedHeight = 0` on resize, then call `onKeepAlive()`
- **Result**: ❌ Same bug

### 2. Don't call onKeepAlive() on resize
- **What**: Match old code exactly - only update width, don't trigger re-render
- **Result**: ❌ Same bug

### 3. Always restore cursor (like old code)
- **What**: Always call `RESTORE_CURSOR` in `renderNow()`, no conditions
- **Result**: ❌ Same bug

### 4. Disable rendering during reRenderLastContent()
- **What**: Added `renderer.disableRendering = true` during component rendering in `reRenderLastContent()`, flush once at end
- **Result**: ❌ Same bug

## Key Differences from Old Code

### Old Code (`region-old.ts`)
- Resize handler: Only updates width, does NOTHING else (no re-render trigger)
- `renderNow()`: Always restores cursor, no conditions
- No `onKeepAlive` callback - it's a single class

### New Code (`region-renderer.ts` + `region.ts`)
- Resize handler: Updates width, then calls `onKeepAlive()` → `reRenderLastContent()` → `flush()` → `renderNow()`
- Split architecture: Low-level renderer + high-level API
- `reRenderLastContent()`: Re-renders all components with new width

## Current State
- Resize handler calls `onKeepAlive()` which triggers `reRenderLastContent()`
- `reRenderLastContent()` disables rendering during component rendering, flushes once
- `renderNow()` always restores cursor position
- Bug still persists

## Observations
- `reRenderLastContent()` updates `renderer.height` but NOT `lastRenderedHeight`
- `renderNow()` updates `lastRenderedHeight` at the end (line 539)
- But if height changes during `reRenderLastContent()`, `renderNow()` might adjust cursor incorrectly

## Different Approaches Found

### region-old.ts (current reference)
- Resize handler: Only updates width, does NOTHING else
- No re-render trigger

### region-unused.ts.bak (alternative approach)
- Resize handler: 
  - Updates width (reads multiple times to ensure fresh)
  - Calls `onKeepAlive()` if available
  - **FALLBACK**: Calls `renderNow()` directly if no `onKeepAlive`
  - Comments say "Force immediate render (bypass throttle) to update with new size"
- This file was likely an earlier working version

### Current code
- Resize handler: Updates width, calls `onKeepAlive()` → `reRenderLastContent()` → `flush()`

## Next Steps to Investigate
1. ✅ Check if `reRenderLastContent()` properly updates `lastRenderedHeight` in renderer - **FOUND**: It doesn't! It only updates `renderer.height` - **FIXED**: Now updates it
2. Check if cursor position becomes invalid after resize (terminal scrolls?)
3. Check if `reRenderLastContent()` is being called multiple times
4. Compare exact flow: old code vs new code when resize happens
5. Maybe the issue is that we shouldn't be calling `onKeepAlive()` on resize at all?
6. ✅ **FIXED**: Update `lastRenderedHeight` in `reRenderLastContent()` before calling `flush()`
7. **NEW**: Try the `region-unused.ts.bak` approach - maybe calling `renderNow()` directly works better?
8. ✅ **FIXED**: Clear `previousFrame` in `reRenderLastContent()` - after resize, terminal may have scrolled, so previousFrame is invalid
9. ✅ **FIXED**: Restore `onKeepAlive()` call on resize - needed to update content with new width
10. **NEW**: After resize, don't restore cursor - trust that we're at end of region (it scrolled with terminal). Just move up from current position.
11. ✅ **FIXED**: Resize handler was disabling auto-wrap even after destroy! This leaves terminal in bad state, causing line insertion on resize. Fixed by checking `isInitialized` before modifying terminal state.
12. **THEORY**: Maybe we're leaving cursor in ambiguous position (start of line) that zsh interprets as needing line insertion on resize. Added explicit MOVE_TO_START_OF_LINE to ensure safe position.
13. ✅ **FIXED**: `reRenderLastContent()` now includes static lines in `totalHeight` calculation - this should fix spacebar prompt being overwritten.
14. ✅ **FIXED**: Added `isReRendering` guard to prevent concurrent `reRenderLastContent()` calls.
15. ✅ **FIXED**: Removed `moveCursorDown(1)` after render loop - now matches old code exactly (saves cursor at start of last line).
16. ✅ **FIXED**: Simplified cursor restore to always restore if saved (matching old code).
17. ✅ **INTEGRATED**: Added cursor position querying using ANSI DSR (`\x1b[6n`). On resize, we now query the actual cursor position and use it to recalibrate our saved position. This should fix the duplicate rendering issue by ensuring we know exactly where the cursor is after resize/scroll.
18. **FIX**: When using queried cursor position, don't move to it - just save it. The cursor is already at the queried position, so we just need to save it as our anchor point, not move to it.
19. ✅ **FIXED**: Off-by-one error in cursor positioning! The bug was:
    - **Problem**: Saved cursor position was inconsistent - initialization saved at "line after region" but after rendering saved at "start of last line"
    - **Symptom**: Rendering would start at current position, then move up one line at a time until reaching top of viewport
    - **Root Cause**: When restoring, we were moving up by `linesToRender` but we should move up by `(linesToRender - 1)` since we're already on the last line
    - **Fix**: 
      1. Made saved positions consistent - both initialization and after rendering now save at "start of last line"
      2. Changed move-up calculation from `moveCursorUp(linesToRender)` to `moveCursorUp(linesToRender - 1)`
    - **Result**: ✅ FIXED - rendering now works correctly!

