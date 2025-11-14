const std = @import("std");
const diff = @import("diff.zig");
const testing = std.testing;

test "Diff: identical frames" {
    const allocator = testing.allocator;

    var prev = std.ArrayList([]u8){};
    defer {
        for (prev.items) |line| allocator.free(line);
        prev.deinit(allocator);
    }

    var curr = std.ArrayList([]u8){};
    defer {
        for (curr.items) |line| allocator.free(line);
        curr.deinit(allocator);
    }

    try prev.append(allocator, try allocator.dupe(u8, "line1"));
    try prev.append(allocator, try allocator.dupe(u8, "line2"));

    try curr.append(allocator, try allocator.dupe(u8, "line1"));
    try curr.append(allocator, try allocator.dupe(u8, "line2"));

    const ops = try diff.diff_frames(prev.items, curr.items, allocator);
    defer allocator.free(ops);

    try testing.expect(ops.len == 2);
    for (ops) |op| {
        try testing.expect(op == .no_change);
    }
    std.debug.print("  ✓ Diff identical frames: {} no_change ops\n", .{ops.len});
}

test "Diff: changed line" {
    const allocator = testing.allocator;

    var prev = std.ArrayList([]u8){};
    defer {
        for (prev.items) |line| allocator.free(line);
        prev.deinit(allocator);
    }

    var curr = std.ArrayList([]u8){};
    defer {
        for (curr.items) |line| allocator.free(line);
        curr.deinit(allocator);
    }

    try prev.append(allocator, try allocator.dupe(u8, "line1"));
    try prev.append(allocator, try allocator.dupe(u8, "line2"));

    try curr.append(allocator, try allocator.dupe(u8, "line1"));
    try curr.append(allocator, try allocator.dupe(u8, "line2_changed"));

    const ops = try diff.diff_frames(prev.items, curr.items, allocator);
    defer allocator.free(ops);

    try testing.expect(ops.len == 2);
    try testing.expect(ops[0] == .no_change);
    try testing.expect(ops[1] == .update_line);
    if (ops[1] == .update_line) {
        try testing.expectEqual(@as(u32, 1), ops[1].update_line.line);
        try testing.expectEqualStrings("line2_changed", ops[1].update_line.content);
    }
    std.debug.print("  ✓ Diff changed line detected\n", .{});
}

test "Diff: inserted line" {
    const allocator = testing.allocator;

    var prev = std.ArrayList([]u8){};
    defer {
        for (prev.items) |line| allocator.free(line);
        prev.deinit(allocator);
    }

    var curr = std.ArrayList([]u8){};
    defer {
        for (curr.items) |line| allocator.free(line);
        curr.deinit(allocator);
    }

    try prev.append(allocator, try allocator.dupe(u8, "line1"));

    try curr.append(allocator, try allocator.dupe(u8, "line1"));
    try curr.append(allocator, try allocator.dupe(u8, "line2"));

    const ops = try diff.diff_frames(prev.items, curr.items, allocator);
    defer allocator.free(ops);

    try testing.expect(ops.len == 2);
    try testing.expect(ops[0] == .no_change);
    try testing.expect(ops[1] == .insert_line);
    if (ops[1] == .insert_line) {
        try testing.expectEqual(@as(u32, 1), ops[1].insert_line.line);
        try testing.expectEqualStrings("line2", ops[1].insert_line.content);
    }
    std.debug.print("  ✓ Diff inserted line detected\n", .{});
}

test "Diff: deleted line" {
    const allocator = testing.allocator;

    var prev = std.ArrayList([]u8){};
    defer {
        for (prev.items) |line| allocator.free(line);
        prev.deinit(allocator);
    }

    var curr = std.ArrayList([]u8){};
    defer {
        for (curr.items) |line| allocator.free(line);
        curr.deinit(allocator);
    }

    try prev.append(allocator, try allocator.dupe(u8, "line1"));
    try prev.append(allocator, try allocator.dupe(u8, "line2"));

    try curr.append(allocator, try allocator.dupe(u8, "line1"));

    const ops = try diff.diff_frames(prev.items, curr.items, allocator);
    defer allocator.free(ops);

    try testing.expect(ops.len == 2);
    try testing.expect(ops[0] == .no_change);
    try testing.expect(ops[1] == .delete_line);
    if (ops[1] == .delete_line) {
        try testing.expectEqual(@as(u32, 1), ops[1].delete_line);
    }
    std.debug.print("  ✓ Diff deleted line detected\n", .{});
}

test "Diff: multiple changes" {
    const allocator = testing.allocator;

    var prev = std.ArrayList([]u8){};
    defer {
        for (prev.items) |line| allocator.free(line);
        prev.deinit(allocator);
    }

    var curr = std.ArrayList([]u8){};
    defer {
        for (curr.items) |line| allocator.free(line);
        curr.deinit(allocator);
    }

    try prev.append(allocator, try allocator.dupe(u8, "line1"));
    try prev.append(allocator, try allocator.dupe(u8, "line2"));
    try prev.append(allocator, try allocator.dupe(u8, "line3"));

    try curr.append(allocator, try allocator.dupe(u8, "line1_changed"));
    try curr.append(allocator, try allocator.dupe(u8, "line2"));
    try curr.append(allocator, try allocator.dupe(u8, "line3"));
    try curr.append(allocator, try allocator.dupe(u8, "line4"));

    const ops = try diff.diff_frames(prev.items, curr.items, allocator);
    defer allocator.free(ops);

    try testing.expect(ops.len == 4);
    try testing.expect(ops[0] == .update_line);
    try testing.expect(ops[1] == .no_change);
    try testing.expect(ops[2] == .no_change);
    try testing.expect(ops[3] == .insert_line);
    std.debug.print("  ✓ Diff multiple changes: {} ops\n", .{ops.len});
}

test "Diff: empty frames" {
    const allocator = testing.allocator;

    var prev = std.ArrayList([]u8){};
    defer {
        for (prev.items) |line| allocator.free(line);
        prev.deinit(allocator);
    }

    var curr = std.ArrayList([]u8){};
    defer {
        for (curr.items) |line| allocator.free(line);
        curr.deinit(allocator);
    }

    const ops = try diff.diff_frames(prev.items, curr.items, allocator);
    defer allocator.free(ops);

    try testing.expect(ops.len == 0);
    std.debug.print("  ✓ Diff empty frames: {} ops\n", .{ops.len});
}

test "Diff: completely different frames" {
    const allocator = testing.allocator;

    var prev = std.ArrayList([]u8){};
    defer {
        for (prev.items) |line| allocator.free(line);
        prev.deinit(allocator);
    }

    var curr = std.ArrayList([]u8){};
    defer {
        for (curr.items) |line| allocator.free(line);
        curr.deinit(allocator);
    }

    try prev.append(allocator, try allocator.dupe(u8, "old1"));
    try prev.append(allocator, try allocator.dupe(u8, "old2"));

    try curr.append(allocator, try allocator.dupe(u8, "new1"));
    try curr.append(allocator, try allocator.dupe(u8, "new2"));

    const ops = try diff.diff_frames(prev.items, curr.items, allocator);
    defer allocator.free(ops);

    try testing.expect(ops.len == 2);
    try testing.expect(ops[0] == .update_line);
    try testing.expect(ops[1] == .update_line);
    std.debug.print("  ✓ Diff completely different frames: {} update ops\n", .{ops.len});
}
