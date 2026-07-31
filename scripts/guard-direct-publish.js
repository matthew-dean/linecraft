#!/usr/bin/env node

if (process.env.LINECRAFT_DUAL_RELEASE !== '1') {
  console.error(
    'Direct publishing is disabled. Use `pnpm release`.'
  );
  process.exitCode = 1;
}
