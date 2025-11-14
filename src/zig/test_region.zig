const std = @import("std");
const region = @import("region.zig");
const testing = std.testing;

test "Region: initialization" {
    const allocator = testing.allocator;
    const stdout = std.fs.File{ .handle = 2 }; // Use stderr for tests to avoid blocking

    var r = try region.Region.init(allocator, 0, 0, 80, 5, stdout);
    r.disable_rendering = true; // Disable actual rendering in tests
    defer r.deinit();

    try testing.expectEqual(@as(u32, 0), r.x);
    try testing.expectEqual(@as(u32, 0), r.y);
    try testing.expectEqual(@as(u32, 80), r.width);
    try testing.expectEqual(@as(u32, 5), r.height);
    try testing.expect(r.pending_frame.items.len == 5);
    try testing.expect(r.previous_frame.items.len == 5);
    std.debug.print("  ✓ Region initialized: {}x{} at ({}, {})\n", .{ r.width, r.height, r.x, r.y });
}

test "Region: set_line expands automatically" {
    const allocator = testing.allocator;
    const stdout = std.fs.File{ .handle = 2 }; // Use stderr for tests to avoid blocking

    var r = try region.Region.init(allocator, 0, 0, 80, 1, stdout);
    r.disable_rendering = true; // Disable actual rendering in tests
    defer r.deinit();

    // Set line 1 (should work)
    try r.set_line(1, "line1");
    try testing.expectEqual(@as(u32, 1), r.height);

    // Set line 5 (should expand)
    try r.set_line(5, "line5");
    try testing.expect(r.height >= 5);
    try testing.expect(r.pending_frame.items.len >= 5);
    std.debug.print("  ✓ Region expanded from 1 to {} lines\n", .{r.height});
}

test "Region: set_line rejects line 0" {
    const allocator = testing.allocator;
    const stdout = std.fs.File{ .handle = 2 }; // Use stderr for tests to avoid blocking

    var r = try region.Region.init(allocator, 0, 0, 80, 1, stdout);
    r.disable_rendering = true; // Disable actual rendering in tests
    defer r.deinit();

    const result = r.set_line(0, "invalid");
    try testing.expectError(error.InvalidLineNumber, result);
    std.debug.print("  ✓ Region correctly rejects line 0\n", .{});
}

test "Region: set with newlines" {
    const allocator = testing.allocator;
    const stdout = std.fs.File{ .handle = 2 }; // Use stderr for tests to avoid blocking

    var r = try region.Region.init(allocator, 0, 0, 80, 1, stdout);
    r.disable_rendering = true; // Disable actual rendering in tests
    defer r.deinit();

    try r.set("line1\nline2\nline3");
    try testing.expect(r.height >= 3);
    try testing.expect(r.pending_frame.items.len >= 3);
    try testing.expectEqualStrings("line1", r.pending_frame.items[0]);
    try testing.expectEqualStrings("line2", r.pending_frame.items[1]);
    try testing.expectEqualStrings("line3", r.pending_frame.items[2]);
    std.debug.print("  ✓ Region set with {} lines\n", .{r.pending_frame.items.len});
}

test "Region: expand_to" {
    const allocator = testing.allocator;
    const stdout = std.fs.File{ .handle = 2 }; // Use stderr for tests to avoid blocking

    var r = try region.Region.init(allocator, 0, 0, 80, 2, stdout);
    r.disable_rendering = true; // Disable actual rendering in tests
    defer r.deinit();

    try r.expand_to(10);
    try testing.expectEqual(@as(u32, 10), r.height);
    try testing.expect(r.pending_frame.items.len == 10);
    try testing.expect(r.previous_frame.items.len == 10);
    std.debug.print("  ✓ Region expanded to {} lines\n", .{r.height});
}

test "Region: clear_line" {
    const allocator = testing.allocator;
    const stdout = std.fs.File{ .handle = 2 }; // Use stderr for tests to avoid blocking

    var r = try region.Region.init(allocator, 0, 0, 80, 3, stdout);
    r.disable_rendering = true; // Disable actual rendering in tests
    defer r.deinit();

    try r.set_line(2, "test");
    try r.clear_line(2);
    try testing.expectEqualStrings("", r.pending_frame.items[1]);
    std.debug.print("  ✓ Region clear_line works\n", .{});
}

test "Region: throttle configuration" {
    const allocator = testing.allocator;
    const stdout = std.fs.File{ .handle = 2 }; // Use stderr for tests to avoid blocking

    var r = try region.Region.init(allocator, 0, 0, 80, 1, stdout);
    r.disable_rendering = true; // Disable actual rendering in tests
    defer r.deinit();

    r.set_throttle_fps(30);
    try testing.expectEqual(@as(u32, 30), r.throttle_state.fps);
    std.debug.print("  ✓ Region throttle set to {} FPS\n", .{r.throttle_state.fps});
}

test "Region: set_line with empty string" {
    const allocator = testing.allocator;
    const stdout = std.fs.File{ .handle = 2 }; // Use stderr for tests to avoid blocking

    var r = try region.Region.init(allocator, 0, 0, 80, 2, stdout);
    r.disable_rendering = true; // Disable actual rendering in tests
    defer r.deinit();

    try r.set_line(1, "test");
    try r.set_line(1, "");
    try testing.expectEqualStrings("", r.pending_frame.items[0]);
    std.debug.print("  ✓ Region set_line with empty string works\n", .{});
}

test "Region: set with empty content" {
    const allocator = testing.allocator;
    const stdout = std.fs.File{ .handle = 2 }; // Use stderr for tests to avoid blocking

    var r = try region.Region.init(allocator, 0, 0, 80, 1, stdout);
    r.disable_rendering = true; // Disable actual rendering in tests
    defer r.deinit();

    try r.set("");
    try testing.expect(r.pending_frame.items.len >= 1);
    std.debug.print("  ✓ Region set with empty content works\n", .{});
}

test "Region: set with single line (no newline)" {
    const allocator = testing.allocator;
    const stdout = std.fs.File{ .handle = 2 }; // Use stderr for tests to avoid blocking

    var r = try region.Region.init(allocator, 0, 0, 80, 1, stdout);
    r.disable_rendering = true; // Disable actual rendering in tests
    defer r.deinit();

    try r.set("single line");
    try testing.expect(r.pending_frame.items.len >= 1);
    try testing.expectEqualStrings("single line", r.pending_frame.items[0]);
    std.debug.print("  ✓ Region set with single line works\n", .{});
}

test "Region: multiple set_line calls" {
    const allocator = testing.allocator;
    const stdout = std.fs.File{ .handle = 2 }; // Use stderr for tests to avoid blocking

    var r = try region.Region.init(allocator, 0, 0, 80, 1, stdout);
    r.disable_rendering = true; // Disable actual rendering in tests
    defer r.deinit();

    try r.set_line(1, "line1");
    try r.set_line(2, "line2");
    try r.set_line(3, "line3");

    try testing.expect(r.height >= 3);
    try testing.expectEqualStrings("line1", r.pending_frame.items[0]);
    try testing.expectEqualStrings("line2", r.pending_frame.items[1]);
    try testing.expectEqualStrings("line3", r.pending_frame.items[2]);
    std.debug.print("  ✓ Multiple set_line calls work correctly\n", .{});
}

test "Region: clear all lines" {
    const allocator = testing.allocator;
    const stdout = std.fs.File{ .handle = 2 }; // Use stderr for tests to avoid blocking

    var r = try region.Region.init(allocator, 0, 0, 80, 3, stdout);
    r.disable_rendering = true; // Disable actual rendering in tests
    defer r.deinit();

    try r.set_line(1, "line1");
    try r.set_line(2, "line2");
    try r.set_line(3, "line3");
    try r.clear();

    // All lines should be empty
    for (r.pending_frame.items) |line| {
        try testing.expectEqualStrings("", line);
    }
    std.debug.print("  ✓ Region clear works for all lines\n", .{});
}
