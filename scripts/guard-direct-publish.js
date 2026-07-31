#!/usr/bin/env node

if (process.env.LINECRAFT_DUAL_RELEASE !== '1') {
  console.error(
    'Direct publishing is disabled. Use `pnpm release:dual --fll <0.5.x> --publish`.'
  );
  process.exitCode = 1;
}
