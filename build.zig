const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Create shared library for Node.js addon
    // In Zig 0.15.x, target and optimize must be set in createModule
    const lib = b.addLibrary(.{
        .name = "linecraft",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/zig/renderer.zig"),
            .target = target,
            .optimize = optimize,
        }),
        .linkage = .dynamic, // Shared library for Node.js addon
    });

    // Link with libc (needed for N-API)
    lib.linkLibC();

    // Install the library (defaults to zig-out/lib/)
    b.installArtifact(lib);

    // Test all modules together
    // Using addTest automatically discovers all test functions
    const test_exe = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/zig/test_runner.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    const run_tests = b.addRunArtifact(test_exe);
    run_tests.has_side_effects = true;
    const test_step = b.step("test", "Run all Zig tests with visible console output");
    test_step.dependOn(&run_tests.step);

    // Individual test modules (can be run separately for focused testing)
    const test_ansi = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/zig/test_ansi.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    const run_test_ansi = b.addRunArtifact(test_ansi);
    run_test_ansi.has_side_effects = true;
    const test_ansi_step = b.step("test:ansi", "Run ANSI tests only");
    test_ansi_step.dependOn(&run_test_ansi.step);

    const test_throttle = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/zig/test_throttle.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    const run_test_throttle = b.addRunArtifact(test_throttle);
    run_test_throttle.has_side_effects = true;
    const test_throttle_step = b.step("test:throttle", "Run Throttle tests only");
    test_throttle_step.dependOn(&run_test_throttle.step);

    const test_buffer = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/zig/test_buffer.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    const run_test_buffer = b.addRunArtifact(test_buffer);
    run_test_buffer.has_side_effects = true;
    const test_buffer_step = b.step("test:buffer", "Run Buffer tests only");
    test_buffer_step.dependOn(&run_test_buffer.step);

    const test_diff = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/zig/test_diff.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    const run_test_diff = b.addRunArtifact(test_diff);
    run_test_diff.has_side_effects = true;
    const test_diff_step = b.step("test:diff", "Run Diff tests only");
    test_diff_step.dependOn(&run_test_diff.step);

    const test_region = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/zig/test_region.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    const run_test_region = b.addRunArtifact(test_region);
    run_test_region.has_side_effects = true;
    const test_region_step = b.step("test:region", "Run Region tests only");
    test_region_step.dependOn(&run_test_region.step);
}
