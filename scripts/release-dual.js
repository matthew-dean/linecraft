#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT_DIR = join(ROOT, '.release');
const FLL_LICENSE = 'LicenseRef-FLL-1.2';
const README_LICENSE_HEADING = '## License';

const FLL_README_SECTION = `## License

This **0.5.x release** is licensed under the **Fair Labor License (FLL) v1.2**.

- If you are an individual with a net worth under **$5M USD**, or
- Your organization is **Fair Labor Compliant** (your CEO or highest-paid
  executive makes no more than **15×** your median employee's total annual
  compensation),

then you may use this software for free, subject to the license terms. Other
operational users must obtain a paid license, for example via
[fllicense.org](https://fllicense.org). Evaluation and testing are permitted for
up to 90 days. See the full license text in [\`LICENSE\`](./LICENSE).
`;

function usage() {
  return `Usage:
  pnpm release:dual --fll 0.5.7
  pnpm release:dual --fll 0.5.7 --publish

Options:
  --fll <version>  Required leading FLL version; must be 0.5.x
  --publish        Publish MIT as "legacy", then FLL as "latest"
  --skip-checks    Skip lint, typecheck, and tests (packing still builds)
  --help           Show this help

The MIT version is read from package.json and must be 0.2.x. Without
--publish, the command only validates and creates both tarballs in .release/.`;
}

function fail(message) {
  throw new Error(message);
}

export function parseArgs(argv) {
  const options = {
    fllVersion: undefined,
    publish: false,
    skipChecks: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--fll') {
      options.fllVersion = argv[++index];
    } else if (arg.startsWith('--fll=')) {
      options.fllVersion = arg.slice('--fll='.length);
    } else if (arg === '--publish') {
      options.publish = true;
    } else if (arg === '--skip-checks') {
      options.skipChecks = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      fail(`Unknown option: ${arg}`);
    }
  }

  return options;
}

export function assertVersionPolicy(mitVersion, fllVersion) {
  if (!/^0\.2\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(mitVersion)) {
    fail(`MIT releases must use the 0.2.x line; received ${mitVersion}`);
  }
  if (!/^0\.5\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(fllVersion)) {
    fail(`FLL releases must use the 0.5.x line; received ${fllVersion}`);
  }
}

export function createFllPackageJson(sourcePackage, fllVersion) {
  return {
    ...sourcePackage,
    version: fllVersion,
    license: FLL_LICENSE,
    licenses: [
      {
        type: FLL_LICENSE,
        url: 'https://fllicense.org',
      },
    ],
  };
}

export function createFllReadme(sourceReadme) {
  const headingIndex = sourceReadme.indexOf(README_LICENSE_HEADING);
  if (headingIndex < 0) {
    fail(`README is missing its ${README_LICENSE_HEADING} section`);
  }
  return sourceReadme.slice(0, headingIndex) + FLL_README_SECTION;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stderr || result.stdout}` : '';
    fail(`${command} ${args.join(' ')} failed${detail}`);
  }
  return options.capture ? result.stdout.trim() : '';
}

function assertSourcePolicy(sourcePackage, mitLicenseText, sourceReadme, fllLicenseText) {
  if (sourcePackage.license !== 'MIT') {
    fail(`Source package must be MIT; received ${String(sourcePackage.license)}`);
  }
  if (!mitLicenseText.startsWith('MIT License\n')) {
    fail('Root LICENSE is not the expected MIT license');
  }
  if (!sourceReadme.includes('0.2.x compatibility releases are licensed under the')) {
    fail('Root README does not describe the MIT 0.2.x source release');
  }
  if (!fllLicenseText.startsWith('Fair Labor License (FLL) v1.2\n')) {
    fail('The staged FLL v1.2 release asset is missing or invalid');
  }
}

function hashDirectory(directory) {
  const hash = createHash('sha256');
  const visit = (current) => {
    for (const name of readdirSync(current).sort()) {
      const path = join(current, name);
      const stats = statSync(path);
      if (stats.isDirectory()) {
        visit(path);
      } else if (stats.isFile()) {
        hash.update(relative(directory, path));
        hash.update(readFileSync(path));
      }
    }
  };
  visit(directory);
  return hash.digest('hex');
}

function pack(cwd) {
  const output = run(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', OUTPUT_DIR],
    { cwd, capture: true }
  );
  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    fail(`Unexpected npm pack response: ${output}`);
  }
  return parsed[0];
}

function assertVersionAvailable(name, version) {
  const result = spawnSync('npm', ['view', `${name}@${version}`, 'version', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status === 0) {
    fail(`${name}@${version} is already published`);
  }
  if (!`${result.stdout}\n${result.stderr}`.includes('E404')) {
    fail(`Could not verify ${name}@${version} availability:\n${result.stderr || result.stdout}`);
  }
}

function assertCleanTrackedWorktree() {
  const status = run('git', ['status', '--porcelain', '--untracked-files=no'], {
    capture: true,
  });
  if (status !== '') {
    fail('Publishing requires a clean tracked worktree');
  }
}

function verifyPublishedPolicy(name, mitVersion, fllVersion) {
  const tags = JSON.parse(run('npm', ['view', name, 'dist-tags', '--json'], { capture: true }));
  const mitLicense = JSON.parse(
    run('npm', ['view', `${name}@${mitVersion}`, 'license', '--json'], { capture: true })
  );
  const fllLicense = JSON.parse(
    run('npm', ['view', `${name}@${fllVersion}`, 'license', '--json'], { capture: true })
  );

  if (tags.legacy !== mitVersion || mitLicense !== 'MIT') {
    fail(`legacy must be ${mitVersion} with MIT`);
  }
  if (tags.latest !== fllVersion || fllLicense !== FLL_LICENSE) {
    fail(`latest must be ${fllVersion} with ${FLL_LICENSE}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options.fllVersion) {
    fail('Missing required --fll <0.5.x version>');
  }

  const sourcePackage = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const sourceReadme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const mitLicenseText = readFileSync(join(ROOT, 'LICENSE'), 'utf8');
  const fllLicenseText = readFileSync(
    join(ROOT, 'scripts', 'release-assets', 'FLL-1.2.txt'),
    'utf8'
  );
  const mitVersion = sourcePackage.version;

  assertVersionPolicy(mitVersion, options.fllVersion);
  assertSourcePolicy(sourcePackage, mitLicenseText, sourceReadme, fllLicenseText);

  if (options.publish) {
    assertCleanTrackedWorktree();
    run('npm', ['whoami'], { capture: true });
    assertVersionAvailable(sourcePackage.name, mitVersion);
    assertVersionAvailable(sourcePackage.name, options.fllVersion);
  }

  if (!options.skipChecks) {
    run('pnpm', ['lint']);
    run('pnpm', ['typecheck']);
    run('pnpm', ['exec', 'vitest', 'run']);
  }
  // TypeScript does not remove outputs for source files that no longer exist.
  // Always build release artifacts from an empty, ignored output directory.
  rmSync(join(ROOT, 'lib'), { recursive: true, force: true });
  run('pnpm', ['build']);

  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const mitPack = pack(ROOT);
  const tempRoot = mkdtempSync(join(tmpdir(), 'linecraft-fll-'));
  try {
    cpSync(join(ROOT, 'lib'), join(tempRoot, 'lib'), { recursive: true });
    writeFileSync(
      join(tempRoot, 'package.json'),
      `${JSON.stringify(createFllPackageJson(sourcePackage, options.fllVersion), null, 2)}\n`
    );
    writeFileSync(join(tempRoot, 'README.md'), createFllReadme(sourceReadme));
    writeFileSync(join(tempRoot, 'LICENSE'), fllLicenseText);

    if (hashDirectory(join(ROOT, 'lib')) !== hashDirectory(join(tempRoot, 'lib'))) {
      fail('MIT and FLL builds are not byte-for-byte synchronized');
    }

    const fllPack = pack(tempRoot);
    const manifest = {
      sourceCommit: run('git', ['rev-parse', 'HEAD'], { capture: true }),
      policy: {
        legacy: { version: mitVersion, license: 'MIT' },
        latest: { version: options.fllVersion, license: FLL_LICENSE },
      },
      artifacts: { mit: mitPack, fll: fllPack },
    };
    writeFileSync(
      join(OUTPUT_DIR, 'release-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`
    );

    const mitTarball = join(OUTPUT_DIR, String(mitPack.filename));
    const fllTarball = join(OUTPUT_DIR, String(fllPack.filename));
    if (!existsSync(mitTarball) || !existsSync(fllTarball)) {
      fail('npm pack did not create both release artifacts');
    }

    if (options.publish) {
      const publishEnv = { LINECRAFT_DUAL_RELEASE: '1' };
      run('npm', ['publish', mitTarball, '--tag', 'legacy', '--access', 'public'], {
        env: publishEnv,
      });
      run('npm', ['publish', fllTarball, '--tag', 'latest', '--access', 'public'], {
        env: publishEnv,
      });
      verifyPublishedPolicy(sourcePackage.name, mitVersion, options.fllVersion);
      console.log(`Published ${sourcePackage.name}@${mitVersion} (MIT/legacy)`);
      console.log(`Published ${sourcePackage.name}@${options.fllVersion} (FLL/latest)`);
    } else {
      console.log(`Prepared MIT legacy artifact: ${mitTarball}`);
      console.log(`Prepared FLL latest artifact: ${fllTarball}`);
      console.log('Dry run only; add --publish after reviewing .release/release-manifest.json');
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
