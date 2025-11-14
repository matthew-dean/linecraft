// Render buffer for batching ANSI operations
const std = @import("std");
const Allocator = std.mem.Allocator;

pub const RenderBuffer = struct {
    data: std.ArrayList(u8),
    allocator: Allocator,
    stdout: std.fs.File,

    pub fn init(allocator: Allocator, stdout: std.fs.File) RenderBuffer {
        return .{
            .data = std.ArrayList(u8){},
            .allocator = allocator,
            .stdout = stdout,
        };
    }

    pub fn deinit(self: *RenderBuffer) void {
        self.data.deinit(self.allocator);
    }

    pub fn write(self: *RenderBuffer, bytes: []const u8) !void {
        try self.data.appendSlice(self.allocator, bytes);
    }

    pub fn flush(self: *RenderBuffer) !void {
        if (self.data.items.len > 0) {
            // Write all data
            try self.stdout.writeAll(self.data.items);
            self.data.clearRetainingCapacity();
        }
    }

    pub fn clear(self: *RenderBuffer) void {
        self.data.clearRetainingCapacity();
    }
};
