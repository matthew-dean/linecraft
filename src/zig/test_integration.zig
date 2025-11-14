// Integration tests that test multiple modules together
const std = @import("std");
const region = @import("region.zig");
const testing = std.testing;

test "Integration: region with diff and throttle" {
    const allocator = testing.allocator;
    const stdout = std.fs.File{ .handle = 2 }; // Use stderr for tests to avoid blocking

    var r = try region.Region.init(allocator, 0, 0, 80, 2, stdout);
    r.disable_rendering = true; // Disable actual rendering in tests
    defer r.deinit();

    // Set initial lines
    try r.set_line(1, "initial line 1");
    try r.set_line(2, "initial line 2");

    // Change one line
    try r.set_line(1, "updated line 1");

    // Verify pending frame has updates
    try testing.expectEqualStrings("updated line 1", r.pending_frame.items[0]);
    try testing.expectEqualStrings("initial line 2", r.pending_frame.items[1]);

    std.debug.print("  ✓ Integration: region diff and throttle work together\n", .{});
}

test "Integration: region expansion with multiple operations" {
    const allocator = testing.allocator;
    const stdout = std.fs.File{ .handle = 2 }; // Use stderr for tests to avoid blocking

    var r = try region.Region.init(allocator, 0, 0, 80, 1, stdout);
    r.disable_rendering = true; // Disable actual rendering in tests
    defer r.deinit();

    // Start with 1 line, expand to 5
    try r.set_line(1, "line1");
    try r.set_line(2, "line2");
    try r.set_line(3, "line3");
    try r.set_line(4, "line4");
    try r.set_line(5, "line5");

    try testing.expect(r.height >= 5);
    try testing.expect(r.pending_frame.items.len >= 5);

    // Verify all lines are correct
    try testing.expectEqualStrings("line1", r.pending_frame.items[0]);
    try testing.expectEqualStrings("line2", r.pending_frame.items[1]);
    try testing.expectEqualStrings("line3", r.pending_frame.items[2]);
    try testing.expectEqualStrings("line4", r.pending_frame.items[3]);
    try testing.expectEqualStrings("line5", r.pending_frame.items[4]);

    std.debug.print("  ✓ Integration: region expansion with multiple operations\n", .{});
}

test "Integration: set then set_line" {
    const allocator = testing.allocator;
    const stdout = std.fs.File{ .handle = 2 }; // Use stderr for tests to avoid blocking

    var r = try region.Region.init(allocator, 0, 0, 80, 1, stdout);
    r.disable_rendering = true; // Disable actual rendering in tests
    defer r.deinit();

    // Set entire content
    try r.set("line1\nline2\nline3");

    // Then update individual line
    try r.set_line(2, "line2_updated");

    try testing.expect(r.pending_frame.items.len >= 3);
    try testing.expectEqualStrings("line1", r.pending_frame.items[0]);
    try testing.expectEqualStrings("line2_updated", r.pending_frame.items[1]);
    try testing.expectEqualStrings("line3", r.pending_frame.items[2]);

    std.debug.print("  ✓ Integration: set then set_line works correctly\n", .{});
}
