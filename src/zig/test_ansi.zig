const std = @import("std");
const ansi = @import("ansi.zig");
const testing = std.testing;

test "ANSI: move_cursor_to generates correct ANSI" {
    const allocator = testing.allocator;
    const seq = try ansi.move_cursor_to(allocator, 10, 5);
    defer allocator.free(seq);

    try testing.expectEqualStrings("\x1b[5;10H", seq);
    std.debug.print("  ✓ move_cursor_to(10, 5): {s}\n", .{seq});
}

test "ANSI: move_cursor_up generates correct ANSI" {
    const allocator = testing.allocator;
    const seq = try ansi.move_cursor_up(allocator, 3);
    defer allocator.free(seq);

    try testing.expectEqualStrings("\x1b[3A", seq);
    std.debug.print("  ✓ move_cursor_up(3): {s}\n", .{seq});
}

test "ANSI: move_cursor_down generates correct ANSI" {
    const allocator = testing.allocator;
    const seq = try ansi.move_cursor_down(allocator, 2);
    defer allocator.free(seq);

    try testing.expectEqualStrings("\x1b[2B", seq);
    std.debug.print("  ✓ move_cursor_down(2): {s}\n", .{seq});
}

test "ANSI: constants are correct" {
    try testing.expectEqualStrings("\x1b[2K", ansi.CLEAR_LINE);
    try testing.expectEqualStrings("\x1b[?25l", ansi.HIDE_CURSOR);
    try testing.expectEqualStrings("\x1b[?25h", ansi.SHOW_CURSOR);
    try testing.expectEqualStrings("\x1b[s", ansi.SAVE_CURSOR);
    try testing.expectEqualStrings("\x1b[u", ansi.RESTORE_CURSOR);
    std.debug.print("  ✓ All ANSI constants verified\n", .{});
}

test "ANSI: move_cursor_to with zero coordinates" {
    const allocator = testing.allocator;
    const seq = try ansi.move_cursor_to(allocator, 0, 0);
    defer allocator.free(seq);

    try testing.expectEqualStrings("\x1b[0;0H", seq);
    std.debug.print("  ✓ move_cursor_to(0, 0): {s}\n", .{seq});
}

test "ANSI: move_cursor_to with large coordinates" {
    const allocator = testing.allocator;
    const seq = try ansi.move_cursor_to(allocator, 200, 100);
    defer allocator.free(seq);

    try testing.expectEqualStrings("\x1b[100;200H", seq);
    std.debug.print("  ✓ move_cursor_to(200, 100): {s}\n", .{seq});
}

test "ANSI: move_cursor_up with zero" {
    const allocator = testing.allocator;
    const seq = try ansi.move_cursor_up(allocator, 0);
    defer allocator.free(seq);

    try testing.expectEqualStrings("\x1b[0A", seq);
    std.debug.print("  ✓ move_cursor_up(0): {s}\n", .{seq});
}
