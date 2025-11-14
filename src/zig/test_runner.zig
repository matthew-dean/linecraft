// Test runner that imports and runs all test modules
// Zig's built-in test runner will discover all test functions
const std = @import("std");

// Import all test modules so their tests are discovered
// Zig's test runner automatically discovers all test functions in imported modules
// We use unique names to avoid duplicate declaration errors
const _test_ansi = @import("test_ansi.zig");
const _test_throttle = @import("test_throttle.zig");
const _test_buffer = @import("test_buffer.zig");
const _test_diff = @import("test_diff.zig");
const _test_region = @import("test_region.zig");
const _test_integration = @import("test_integration.zig");

// Suppress unused variable warnings
comptime {
    _ = _test_ansi;
    _ = _test_throttle;
    _ = _test_buffer;
    _ = _test_diff;
    _ = _test_region;
    _ = _test_integration;
}

// This file serves as the root for test discovery
// All test functions in imported modules will be run
// Each test prints its own output using std.debug.print() for visibility
