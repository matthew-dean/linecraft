// Diffing algorithm for efficient updates
const std = @import("std");
const Allocator = std.mem.Allocator;

pub const DiffOp = union(enum) {
    no_change: void,
    update_line: struct { line: u32, content: []u8 },
    delete_line: u32,
    insert_line: struct { line: u32, content: []u8 },
};

pub fn diff_frames(
    prev: [][]u8,
    curr: [][]u8,
    allocator: Allocator,
) ![]DiffOp {
    var ops = std.ArrayList(DiffOp){};
    errdefer ops.deinit(allocator);

    const max_len = @max(prev.len, curr.len);

    for (0..max_len) |i| {
        const prev_line = if (i < prev.len) prev[i] else null;
        const curr_line = if (i < curr.len) curr[i] else null;

        if (prev_line == null and curr_line != null) {
            // Line inserted
            try ops.append(allocator, .{ .insert_line = .{ .line = @intCast(i), .content = curr_line.? } });
        } else if (prev_line != null and curr_line == null) {
            // Line deleted
            try ops.append(allocator, .{ .delete_line = @intCast(i) });
        } else if (prev_line != null and curr_line != null) {
            // Check if line changed
            if (!std.mem.eql(u8, prev_line.?, curr_line.?)) {
                try ops.append(allocator, .{ .update_line = .{ .line = @intCast(i), .content = curr_line.? } });
            } else {
                try ops.append(allocator, .no_change);
            }
        }
    }

    return try ops.toOwnedSlice(allocator);
}
