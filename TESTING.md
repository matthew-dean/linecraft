# Testing EchoKit

## Running Tests

### All Tests
```bash
zig build test
# or
pnpm test
```

### Individual Test Modules
```bash
# ANSI tests only
zig build test:ansi

# Throttle tests only
zig build test:throttle

# Buffer tests only
zig build test:buffer

# Diff tests only
zig build test:diff

# Region tests only
zig build test:region
```

## Test Coverage

### ANSI Module (`test_ansi.zig`)
- ✅ `move_cursor_to` - Generates correct cursor positioning ANSI
- ✅ `move_cursor_up` - Generates correct up movement ANSI
- ✅ `move_cursor_down` - Generates correct down movement ANSI
- ✅ ANSI constants - All constants verified
- ✅ `move_cursor_to` with zero coordinates
- ✅ `move_cursor_to` with large coordinates
- ✅ `move_cursor_up` with zero

### Throttle Module (`test_throttle.zig`)
- ✅ Initialization - Creates throttle with correct FPS
- ✅ `set_fps` - Changes FPS correctly
- ✅ `should_render` - Allows first frame
- ✅ `should_render` - Respects interval (blocks immediate second frame)
- ✅ `time_until_next_frame` - Calculates remaining time correctly
- ✅ Very high FPS (1000 FPS)
- ✅ Very low FPS (1 FPS)

### Buffer Module (`test_buffer.zig`)
- ✅ Initialization - Creates empty buffer
- ✅ `write` - Appends data correctly
- ✅ `clear` - Clears buffer
- ✅ `flush` - Writes to stdout and clears
- ✅ Large content handling
- ✅ Multiple writes and flush

### Diff Module (`test_diff.zig`)
- ✅ Identical frames - Returns no_change ops
- ✅ Changed line - Detects line updates
- ✅ Inserted line - Detects new lines
- ✅ Deleted line - Detects removed lines
- ✅ Multiple changes - Handles complex diffs
- ✅ Empty frames
- ✅ Completely different frames

### Region Module (`test_region.zig`)
- ✅ Initialization - Creates region with correct dimensions
- ✅ `set_line` - Expands automatically when needed
- ✅ `set_line` - Rejects line 0 (1-based indexing)
- ✅ `set` - Splits content by newlines correctly
- ✅ `expand_to` - Expands region height
- ✅ `clear_line` - Clears individual lines
- ✅ Throttle configuration - Sets FPS correctly
- ✅ `set_line` with empty string
- ✅ `set` with empty content
- ✅ `set` with single line (no newline)
- ✅ Multiple `set_line` calls
- ✅ `clear` all lines

### Integration Tests (`test_integration.zig`)
- ✅ Region with diff and throttle together
- ✅ Region expansion with multiple operations
- ✅ `set` then `set_line` interaction

## Test Output

All tests print visible output to the console using `std.debug.print()`. Each test shows:
- ✓ Checkmark for passed assertions
- Test name and module
- Relevant values being tested

Example output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Testing: ANSI Module
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ move_cursor_to(10, 5): [1b[5;10H
  ✓ move_cursor_up(3): [1b[3A
  ✓ All ANSI constants verified
```

