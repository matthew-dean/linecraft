const std = @import("std");
const throttle = @import("throttle.zig");
const testing = std.testing;

test "Throttle: initialization" {
    const t = throttle.Throttle.init(60);
    try testing.expectEqual(@as(u32, 60), t.fps);
    try testing.expect(t.min_frame_interval > 0);
    std.debug.print("  ✓ Throttle initialized: {} FPS, {}ns interval\n", .{ t.fps, t.min_frame_interval });
}

test "Throttle: set_fps" {
    var t = throttle.Throttle.init(30);
    t.set_fps(120);
    try testing.expectEqual(@as(u32, 120), t.fps);
    std.debug.print("  ✓ Throttle FPS changed to: {}\n", .{t.fps});
}

test "Throttle: should_render allows first frame" {
    var t = throttle.Throttle.init(60);
    // First call should always allow render
    const should = t.should_render();
    try testing.expect(should);
    std.debug.print("  ✓ First frame allowed\n", .{});
}

test "Throttle: should_render respects interval" {
    var t = throttle.Throttle.init(1000); // 1 FPS = 1 second interval
    _ = t.should_render(); // First frame

    // Immediately after, should not render
    const should = t.should_render();
    try testing.expect(!should);
    std.debug.print("  ✓ Throttle correctly blocks immediate second frame\n", .{});
}

test "Throttle: time_until_next_frame" {
    var t = throttle.Throttle.init(10); // 10 FPS = 100ms interval
    _ = t.should_render();

    const remaining = t.time_until_next_frame();
    try testing.expect(remaining > 0);
    try testing.expect(remaining <= 100_000_000); // Should be <= 100ms in nanoseconds
    std.debug.print("  ✓ Time until next frame: {}ns\n", .{remaining});
}

test "Throttle: very high FPS" {
    const t = throttle.Throttle.init(1000); // 1000 FPS
    try testing.expectEqual(@as(u32, 1000), t.fps);
    try testing.expect(t.min_frame_interval > 0);
    std.debug.print("  ✓ Throttle handles high FPS: {} FPS, {}ns interval\n", .{ t.fps, t.min_frame_interval });
}

test "Throttle: very low FPS" {
    const t = throttle.Throttle.init(1); // 1 FPS
    try testing.expectEqual(@as(u32, 1), t.fps);
    try testing.expect(t.min_frame_interval == 1_000_000_000); // 1 second
    std.debug.print("  ✓ Throttle handles low FPS: {} FPS, {}ns interval\n", .{ t.fps, t.min_frame_interval });
}
