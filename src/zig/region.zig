// Region management for terminal rendering
const std = @import("std");
const Allocator = std.mem.Allocator;
const ansi = @import("ansi.zig");
const diff = @import("diff.zig");
const buffer = @import("buffer.zig");
const throttle = @import("throttle.zig");

pub const Region = struct {
    allocator: Allocator,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    pending_frame: std.ArrayList([]u8),
    previous_frame: std.ArrayList([]u8),
    render_scheduled: bool,
    throttle_state: throttle.Throttle,
    render_buffer: buffer.RenderBuffer,
    stdout: std.fs.File,
    disable_rendering: bool = false, // For tests - skip actual rendering

    pub fn init(
        allocator: Allocator,
        x: u32,
        y: u32,
        width: u32,
        height: u32,
        stdout: std.fs.File,
    ) !Region {
        var pending = std.ArrayList([]u8){};
        var previous = std.ArrayList([]u8){};

        // Initialize with empty lines
        try pending.ensureTotalCapacity(allocator, height);
        try previous.ensureTotalCapacity(allocator, height);
        for (0..height) |_| {
            try pending.append(allocator, try allocator.dupe(u8, ""));
            try previous.append(allocator, try allocator.dupe(u8, ""));
        }

        return .{
            .allocator = allocator,
            .x = x,
            .y = y,
            .width = width,
            .height = height,
            .pending_frame = pending,
            .previous_frame = previous,
            .render_scheduled = false,
            .throttle_state = throttle.Throttle.init(60),
            .render_buffer = buffer.RenderBuffer.init(allocator, stdout),
            .stdout = stdout,
        };
    }

    pub fn deinit(self: *Region) void {
        // Free frame buffers
        for (self.pending_frame.items) |line| {
            self.allocator.free(line);
        }
        self.pending_frame.deinit(self.allocator);

        for (self.previous_frame.items) |line| {
            self.allocator.free(line);
        }
        self.previous_frame.deinit(self.allocator);

        self.render_buffer.deinit();
    }

    pub fn expand_to(self: *Region, new_height: u32) !void {
        const old_height = self.height;
        _ = old_height; // autofix
        self.height = new_height;

        // Expand pending_frame
        try self.pending_frame.ensureTotalCapacity(self.allocator, new_height);
        while (self.pending_frame.items.len < new_height) {
            try self.pending_frame.append(self.allocator, try self.allocator.dupe(u8, ""));
        }

        // Expand previous_frame
        try self.previous_frame.ensureTotalCapacity(self.allocator, new_height);
        while (self.previous_frame.items.len < new_height) {
            try self.previous_frame.append(self.allocator, try self.allocator.dupe(u8, ""));
        }
    }

    pub fn set_line(self: *Region, line_number: u32, content: []const u8) !void {
        // Convert 1-based to 0-based
        if (line_number == 0) {
            return error.InvalidLineNumber;
        }
        const line_index = line_number - 1;

        // Expand if needed
        if (line_index >= self.height) {
            try self.expand_to(line_index + 1);
        }

        // Ensure pending_frame has enough lines
        while (self.pending_frame.items.len <= line_index) {
            try self.pending_frame.append(self.allocator, try self.allocator.dupe(u8, ""));
        }

        // Free old line and set new one
        self.allocator.free(self.pending_frame.items[line_index]);
        self.pending_frame.items[line_index] = try self.allocator.dupe(u8, content);

        // Schedule render
        self.schedule_render();
    }

    pub fn set(self: *Region, content: []const u8) !void {
        // Split by \n to get lines
        var lines = std.ArrayList([]const u8){};
        defer lines.deinit(self.allocator);

        var it = std.mem.splitScalar(u8, content, '\n');
        while (it.next()) |line| {
            try lines.append(self.allocator, line);
        }

        // Expand region if needed
        if (lines.items.len > self.height) {
            try self.expand_to(@intCast(lines.items.len));
        }

        // Free old pending frame
        for (self.pending_frame.items) |line| {
            self.allocator.free(line);
        }
        self.pending_frame.clearRetainingCapacity();

        // Update all lines in pending_frame
        try self.pending_frame.ensureTotalCapacity(self.allocator, lines.items.len);
        for (lines.items) |line| {
            try self.pending_frame.append(self.allocator, try self.allocator.dupe(u8, line));
        }

        // Schedule render
        self.schedule_render();
    }

    pub fn schedule_render(self: *Region) void {
        // Skip rendering if disabled (for tests)
        if (self.disable_rendering) {
            // Just copy pending to previous without actually rendering
            self.copy_pending_to_previous() catch {};
            return;
        }

        if (self.throttle_state.should_render()) {
            self.render_now() catch |e| {
                std.log.err("Render error: {}", .{e});
            };
        } else {
            self.render_scheduled = true;
        }
    }

    fn copy_pending_to_previous(self: *Region) !void {
        // Free old previous_frame
        for (self.previous_frame.items) |line| {
            self.allocator.free(line);
        }
        self.previous_frame.clearRetainingCapacity();

        // Copy pending to previous
        try self.previous_frame.ensureTotalCapacity(self.allocator, self.pending_frame.items.len);
        for (self.pending_frame.items) |line| {
            try self.previous_frame.append(self.allocator, try self.allocator.dupe(u8, line));
        }
    }

    pub fn render_now(self: *Region) !void {
        // Hide cursor
        try self.render_buffer.write(ansi.HIDE_CURSOR);

        // Move to region start
        const move_seq = try ansi.move_cursor_to(self.allocator, self.x, self.y);
        defer self.allocator.free(move_seq);
        try self.render_buffer.write(move_seq);

        // Diff and render
        const diff_ops = try diff.diff_frames(
            self.previous_frame.items,
            self.pending_frame.items,
            self.allocator,
        );
        defer {
            for (diff_ops) |_| {}
            self.allocator.free(diff_ops);
        }

        var current_line: u32 = 0;
        for (diff_ops) |op| {
            switch (op) {
                .update_line => |update| {
                    // Move to line if needed
                    if (update.line != current_line) {
                        const move = try ansi.move_cursor_to(
                            self.allocator,
                            self.x,
                            self.y + update.line,
                        );
                        defer self.allocator.free(move);
                        try self.render_buffer.write(move);
                        current_line = update.line;
                    }

                    // Clear line and write new content
                    try self.render_buffer.write(ansi.CLEAR_LINE);
                    try self.render_buffer.write(update.content);
                    current_line += 1;
                },
                .insert_line => |insert| {
                    // Move to line
                    const move = try ansi.move_cursor_to(
                        self.allocator,
                        self.x,
                        self.y + insert.line,
                    );
                    defer self.allocator.free(move);
                    try self.render_buffer.write(move);

                    // Write content
                    try self.render_buffer.write(insert.content);
                    current_line = insert.line + 1;
                },
                .delete_line => |del| {
                    // Move to line and clear it
                    const move = try ansi.move_cursor_to(
                        self.allocator,
                        self.x,
                        self.y + del,
                    );
                    defer self.allocator.free(move);
                    try self.render_buffer.write(move);
                    try self.render_buffer.write(ansi.CLEAR_LINE);
                },
                .no_change => {
                    // Skip unchanged lines
                    current_line += 1;
                },
            }
        }

        // Show cursor
        try self.render_buffer.write(ansi.SHOW_CURSOR);

        // Flush buffer
        try self.render_buffer.flush();

        // Copy pending_frame to previous_frame
        for (self.previous_frame.items) |line| {
            self.allocator.free(line);
        }
        self.previous_frame.clearRetainingCapacity();

        try self.previous_frame.ensureTotalCapacity(self.allocator, self.pending_frame.items.len);
        for (self.pending_frame.items) |line| {
            try self.previous_frame.append(self.allocator, try self.allocator.dupe(u8, line));
        }

        self.render_scheduled = false;
    }

    pub fn flush(self: *Region) !void {
        // Force immediate render
        try self.render_now();
    }

    pub fn set_throttle_fps(self: *Region, fps: u32) void {
        self.throttle_state.set_fps(fps);
    }

    pub fn clear_line(self: *Region, line_number: u32) !void {
        if (line_number == 0) {
            return error.InvalidLineNumber;
        }
        try self.set_line(line_number, "");
    }

    pub fn clear(self: *Region) !void {
        // Clear all lines
        for (0..self.height) |i| {
            try self.set_line(@intCast(i + 1), "");
        }
    }
};
