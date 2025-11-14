// Main renderer with N-API bindings
const std = @import("std");
const region = @import("region.zig");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
const allocator = gpa.allocator();

var regions = std.ArrayList(*region.Region){};
var region_mutex = std.Thread.Mutex{};

// Get stdout file handle
fn get_stdout() std.fs.File {
    return std.fs.File{ .handle = 1 }; // stdout handle
}

export fn create_region(x: u32, y: u32, width: u32, height: u32) u64 {
    region_mutex.lock();
    defer region_mutex.unlock();

    const r = allocator.create(region.Region) catch return 0;
    r.* = region.Region.init(allocator, x, y, width, height, get_stdout()) catch {
        allocator.destroy(r);
        return 0;
    };

    regions.append(allocator, r) catch {
        r.deinit();
        allocator.destroy(r);
        return 0;
    };

    return @intFromPtr(r);
}

export fn destroy_region(handle: u64) void {
    region_mutex.lock();
    defer region_mutex.unlock();

    const r = @as(*region.Region, @ptrFromInt(handle));
    r.deinit();
    allocator.destroy(r);

    // Remove from regions list
    for (regions.items, 0..) |reg, i| {
        if (reg == r) {
            _ = regions.swapRemove(i);
            break;
        }
    }
}

export fn set_line(handle: u64, line_number: u32, content: [*]const u8, len: usize) void {
    const r = @as(*region.Region, @ptrFromInt(handle));
    const content_slice = content[0..len];
    r.set_line(line_number, content_slice) catch |e| {
        std.log.err("set_line error: {}", .{e});
    };
}

export fn set(handle: u64, content: [*]const u8, len: usize) void {
    const r = @as(*region.Region, @ptrFromInt(handle));
    const content_slice = content[0..len];
    r.set(content_slice) catch |e| {
        std.log.err("set error: {}", .{e});
    };
}

export fn clear_line(handle: u64, line_number: u32) void {
    const r = @as(*region.Region, @ptrFromInt(handle));
    r.clear_line(line_number) catch |e| {
        std.log.err("clear_line error: {}", .{e});
    };
}

export fn clear_region(handle: u64) void {
    const r = @as(*region.Region, @ptrFromInt(handle));
    r.clear() catch |e| {
        std.log.err("clear_region error: {}", .{e});
    };
}

export fn flush(handle: u64) void {
    const r = @as(*region.Region, @ptrFromInt(handle));
    r.flush() catch |e| {
        std.log.err("flush error: {}", .{e});
    };
}

export fn set_throttle_fps(handle: u64, fps: u32) void {
    const r = @as(*region.Region, @ptrFromInt(handle));
    r.set_throttle_fps(fps);
}
