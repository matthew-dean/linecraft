const std = @import("std");
const buffer = @import("buffer.zig");
const testing = std.testing;

test "Buffer: initialization" {
    const stdout = std.fs.File{ .handle = 1 }; // stdout handle
    var buf = buffer.RenderBuffer.init(testing.allocator, stdout);
    defer buf.deinit();

    try testing.expect(buf.data.items.len == 0);
    std.debug.print("  ✓ Buffer initialized\n", .{});
}

test "Buffer: write" {
    const stdout = std.fs.File{ .handle = 1 }; // stdout handle
    var buf = buffer.RenderBuffer.init(testing.allocator, stdout);
    defer buf.deinit();

    try buf.write("hello");
    try buf.write(" world");

    try testing.expectEqualStrings("hello world", buf.data.items);
    std.debug.print("  ✓ Buffer write: {s}\n", .{buf.data.items});
}

test "Buffer: clear" {
    const stdout = std.fs.File{ .handle = 1 }; // stdout handle
    var buf = buffer.RenderBuffer.init(testing.allocator, stdout);
    defer buf.deinit();

    try buf.write("test");
    buf.clear();

    try testing.expect(buf.data.items.len == 0);
    std.debug.print("  ✓ Buffer cleared\n", .{});
}

test "Buffer: flush" {
    // Use stderr for test output to avoid conflicts with test runner
    // In production, this would be stdout, but for tests stderr is safer
    const stderr = std.fs.File{ .handle = 2 };
    var buf = buffer.RenderBuffer.init(testing.allocator, stderr);
    defer buf.deinit();

    try buf.write("flush test\n");
    // Flush to stderr - this should work and be visible
    try buf.flush();

    try testing.expect(buf.data.items.len == 0);
    std.debug.print("  ✓ Buffer flushed (wrote to stderr)\n", .{});
}

test "Buffer: write large content" {
    const stdout = std.fs.File{ .handle = 1 }; // stdout handle
    var buf = buffer.RenderBuffer.init(testing.allocator, stdout);
    defer buf.deinit();

    const large_content = "x" ** 1000;
    try buf.write(large_content);

    try testing.expect(buf.data.items.len == 1000);
    std.debug.print("  ✓ Buffer handles large content: {} bytes\n", .{buf.data.items.len});
}

test "Buffer: multiple writes and flush" {
    // Use stderr for test output
    const stderr = std.fs.File{ .handle = 2 };
    var buf = buffer.RenderBuffer.init(testing.allocator, stderr);
    defer buf.deinit();

    try buf.write("part1");
    try buf.write("part2");
    try buf.write("part3\n");

    // Verify all parts are in buffer
    try testing.expectEqualStrings("part1part2part3\n", buf.data.items);

    // Flush to stderr - should be visible
    try buf.flush();
    try testing.expect(buf.data.items.len == 0);
    std.debug.print("  ✓ Buffer multiple writes and flush works\n", .{});
}
