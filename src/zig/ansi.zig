// ANSI escape code generation
const std = @import("std");
const Allocator = std.mem.Allocator;

pub fn move_cursor_to(allocator: Allocator, x: u32, y: u32) ![]u8 {
    return try std.fmt.allocPrint(allocator, "\x1b[{d};{d}H", .{ y, x });
}

pub fn move_cursor_up(allocator: Allocator, n: u32) ![]u8 {
    return try std.fmt.allocPrint(allocator, "\x1b[{d}A", .{n});
}

pub fn move_cursor_down(allocator: Allocator, n: u32) ![]u8 {
    return try std.fmt.allocPrint(allocator, "\x1b[{d}B", .{n});
}

pub const CLEAR_LINE = "\x1b[2K";
pub const HIDE_CURSOR = "\x1b[?25l";
pub const SHOW_CURSOR = "\x1b[?25h";
pub const SAVE_CURSOR = "\x1b[s";
pub const RESTORE_CURSOR = "\x1b[u";
