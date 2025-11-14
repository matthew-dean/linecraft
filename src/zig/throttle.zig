// Throttling for frame rate limiting
const std = @import("std");

pub const Throttle = struct {
    last_frame_time: i64,
    min_frame_interval: i64, // nanoseconds
    fps: u32,

    pub fn init(fps: u32) Throttle {
        const interval_ns = @divTrunc(1_000_000_000, @as(i64, fps));
        return .{
            .last_frame_time = 0,
            .min_frame_interval = interval_ns,
            .fps = fps,
        };
    }

    pub fn set_fps(self: *Throttle, fps: u32) void {
        self.fps = fps;
        self.min_frame_interval = @divTrunc(1_000_000_000, @as(i64, fps));
    }

    pub fn should_render(self: *Throttle) bool {
        const now = @as(i64, @intCast(std.time.nanoTimestamp()));
        if (now - self.last_frame_time >= self.min_frame_interval) {
            self.last_frame_time = now;
            return true;
        }
        return false;
    }

    pub fn time_until_next_frame(self: *Throttle) i64 {
        const now = @as(i64, @intCast(std.time.nanoTimestamp()));
        const elapsed = now - self.last_frame_time;
        const remaining = self.min_frame_interval - elapsed;
        return if (remaining > 0) @as(i64, @intCast(remaining)) else 0;
    }
};
