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
const REGISTRY_VERIFY_ATTEMPTS = 6;
const REGISTRY_VERIFY_DELAY_MS = 2_000;

const MIT_README_SECTION = `## License

This **0.2.x compatibility release** is licensed under the **MIT License**.

The current 0.5.x release line uses the Fair Labor License. See the full MIT
license text bundled with this package in [\`LICENSE\`](./LICENSE).
`;

function usage() {
  return `Usage:
  pnpm release
  pnpm release:dry-run

The FLL 0.5.x version is read from package.json. The matching MIT 0.2.x
version is derived from the same patch version. release:dry-run creates both
tarballs in .release/ without publishing.`;
}

function fail(message) {
  throw new Error(message);
}

export function sanitizeNpmEnvironment(environment) {
  const sanitized = { ...environment };
  for (const key of Object.keys(sanitized)) {
    const normalized = key.toLowerCase();
    if (
      normalized === 'npm_config_verify_deps_before_run' ||
      /^npm_config__.+_registry$/.test(normalized)
    ) {
      delete sanitized[key];
    }
  }
  return sanitized;
}

export function isTransientRegistryVerificationError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /\bE404\b|\b404\b|No match found/u.test(message) ||
    /\bE(?:CONNRESET|TIMEDOUT|AI_AGAIN)\b|\b50[0234]\b/u.test(message) ||
    message.startsWith('legacy must be ') ||
    message.startsWith('latest must be ')
  );
}

export function isImmutablePublishConflict(output) {
  return (
    /\bEPUBLISHCONFLICT\b/u.test(output) ||
    /cannot publish over (?:the )?previously published version/iu.test(output) ||
    /cannot publish over the previously published versions/iu.test(output)
  );
}

export function selectResumeVersions(tags, mitVersion, fllVersion) {
  return {
    mit: tags.legacy === mitVersion ? mitVersion : null,
    fll: tags.latest === fllVersion ? fllVersion : null,
  };
}

export function inspectReleaseRegistry(name, mitVersion, fllVersion, reader) {
  const tags = reader.getTags(name);
  const resumeVersions = selectResumeVersions(tags, mitVersion, fllVersion);
  return {
    tags,
    mitLicense: resumeVersions.mit
      ? reader.getLicense(name, resumeVersions.mit, { retryNotFound: true })
      : null,
    fllLicense: resumeVersions.fll
      ? reader.getLicense(name, resumeVersions.fll, { retryNotFound: true })
      : null,
  };
}

export function formatProcessFailure(result) {
  if (result.error) {
    return result.error.message;
  }
  if (result.signal) {
    return `terminated by signal ${result.signal}`;
  }
  return result.stderr || result.stdout || `exited with status ${String(result.status)}`;
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

export function assertVersionPolicy(mitVersion, fllVersion) {
  if (!/^0\.2\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(mitVersion)) {
    fail(`MIT releases must use the 0.2.x line; received ${mitVersion}`);
  }
  if (!/^0\.5\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(fllVersion)) {
    fail(`FLL releases must use the 0.5.x line; received ${fllVersion}`);
  }
}

export function deriveMitVersion(fllVersion) {
  if (!/^0\.5\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(fllVersion)) {
    fail(`FLL releases must use the 0.5.x line; received ${fllVersion}`);
  }
  return fllVersion.replace(/^0\.5\./, '0.2.');
}

export function createMitPackageJson(sourcePackage, mitVersion) {
  const transformed = {
    ...sourcePackage,
    version: mitVersion,
    license: 'MIT',
  };
  delete transformed.licenses;
  return transformed;
}

export function createMitReadme(sourceReadme) {
  const headingIndex = sourceReadme.indexOf(README_LICENSE_HEADING);
  if (headingIndex < 0) {
    fail(`README is missing its ${README_LICENSE_HEADING} section`);
  }
  return sourceReadme.slice(0, headingIndex) + MIT_README_SECTION;
}

function run(command, args, options = {}) {
  const environment = { ...process.env, ...options.env };
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: 'utf8',
    env: command === 'npm' ? sanitizeNpmEnvironment(environment) : environment,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (result.status !== 0) {
    const detail = options.capture ? `\n${result.stderr || result.stdout}` : '';
    fail(`${command} ${args.join(' ')} failed${detail}`);
  }
  return options.capture ? result.stdout.trim() : '';
}

function assertSourcePolicy(sourcePackage, fllLicenseText, sourceReadme, mitLicenseText) {
  if (sourcePackage.license !== FLL_LICENSE) {
    fail(`Source package must be ${FLL_LICENSE}; received ${String(sourcePackage.license)}`);
  }
  if (!fllLicenseText.startsWith('Fair Labor License (FLL) v1.2\n')) {
    fail('Root LICENSE is not the expected FLL v1.2 license');
  }
  if (!sourceReadme.includes('Fair Labor License (FLL) v1.2')) {
    fail('Root README does not describe the FLL v1.2 release');
  }
  if (!mitLicenseText.startsWith('MIT License\n')) {
    fail('The staged MIT release asset is missing or invalid');
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

function getPublishedLicense(name, version, options = {}) {
  const spec = `${name}@${version}`;
  const attempts = options.retryNotFound ? REGISTRY_VERIFY_ATTEMPTS : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = spawnSync('npm', ['view', spec, 'license', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: sanitizeNpmEnvironment(process.env),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status === 0) {
      return JSON.parse(result.stdout);
    }
    const detail = `${result.stdout}\n${result.stderr}`;
    if (!detail.includes('E404')) {
      fail(`Could not verify ${spec} availability:\n${result.stderr || result.stdout}`);
    }
    if (attempt < attempts) {
      console.warn(
        `${spec} returned 404; retrying before treating the version as unpublished ` +
        `(${attempt}/${attempts})`
      );
      sleep(REGISTRY_VERIFY_DELAY_MS);
    }
  }
  return null;
}

export function validateExistingRelease(spec, actualLicense, expectedLicense) {
  if (actualLicense !== null && actualLicense !== expectedLicense) {
    fail(`${spec} is already published with ${actualLicense}; expected ${expectedLicense}`);
  }
  return actualLicense === expectedLicense ? 'resume' : 'publish';
}

function publishOrResume(
  name,
  version,
  actualLicense,
  expectedLicense,
  tarball,
  tag,
  publishEnv
) {
  const spec = `${name}@${version}`;
  const disposition = validateExistingRelease(spec, actualLicense, expectedLicense);
  if (disposition === 'publish') {
    const result = spawnSync(
      'npm',
      ['publish', tarball, '--tag', tag, '--access', 'public'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: sanitizeNpmEnvironment({ ...process.env, ...publishEnv }),
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    if (result.status === 0) {
      process.stdout.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
      return;
    }

    const detail = formatProcessFailure(result);
    if (!isImmutablePublishConflict(detail)) {
      fail(`npm publish ${tarball} failed\n${detail}`);
    }

    const recoveredLicense = getPublishedLicense(name, version, {
      retryNotFound: true,
    });
    if (recoveredLicense === null) {
      fail(`npm reported ${spec} already exists, but its metadata could not be read`);
    }
    validateExistingRelease(spec, recoveredLicense, expectedLicense);
  }

  console.log(`${spec} already has ${expectedLicense}; resuming release`);
  run('npm', ['dist-tag', 'add', spec, tag]);
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
  for (let attempt = 1; attempt <= REGISTRY_VERIFY_ATTEMPTS; attempt++) {
    try {
      const tags = JSON.parse(
        run('npm', ['view', name, 'dist-tags', '--json'], { capture: true })
      );
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
      return;
    } catch (error) {
      if (
        attempt === REGISTRY_VERIFY_ATTEMPTS ||
        !isTransientRegistryVerificationError(error)
      ) {
        throw error;
      }
      console.warn(
        `npm registry metadata has not converged yet; retrying verification ` +
        `(${attempt}/${REGISTRY_VERIFY_ATTEMPTS})`
      );
      sleep(REGISTRY_VERIFY_DELAY_MS);
    }
  }
}

function assertNpmAuthentication() {
  try {
    const username = run('npm', ['whoami'], { capture: true });
    console.log(`npm authenticated as ${username}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(
      'npm authentication failed. Run `npm login --registry=https://registry.npmjs.org/`, ' +
      'confirm `npm whoami`, then rerun `pnpm release`.\n' + detail
    );
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return;
  }
  const unexpectedArgs = args.filter((arg) => arg !== '--publish');
  if (unexpectedArgs.length > 0) {
    fail(`Unknown option: ${unexpectedArgs[0]}`);
  }
  const publish = args.includes('--publish');

  const sourcePackage = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const sourceReadme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const fllLicenseText = readFileSync(join(ROOT, 'LICENSE'), 'utf8');
  const mitLicenseText = readFileSync(
    join(ROOT, 'scripts', 'release-assets', 'MIT.txt'),
    'utf8'
  );
  const fllVersion = sourcePackage.version;
  const mitVersion = deriveMitVersion(fllVersion);
  let publishedMitLicense = null;
  let publishedFllLicense = null;

  assertVersionPolicy(mitVersion, fllVersion);
  assertSourcePolicy(sourcePackage, fllLicenseText, sourceReadme, mitLicenseText);

  if (publish) {
    assertCleanTrackedWorktree();
    assertNpmAuthentication();
    const registry = inspectReleaseRegistry(
      sourcePackage.name,
      mitVersion,
      fllVersion,
      {
        getTags: (name) => JSON.parse(
          run('npm', ['view', name, 'dist-tags', '--json'], { capture: true })
        ),
        getLicense: (name, version, options) =>
          getPublishedLicense(name, version, options),
      }
    );
    console.log(
      `npm registry currently has legacy=${String(registry.tags.legacy)} and ` +
      `latest=${String(registry.tags.latest)}`
    );
    publishedMitLicense = registry.mitLicense;
    publishedFllLicense = registry.fllLicense;
    validateExistingRelease(
      `${sourcePackage.name}@${mitVersion}`,
      publishedMitLicense,
      'MIT'
    );
    validateExistingRelease(
      `${sourcePackage.name}@${fllVersion}`,
      publishedFllLicense,
      FLL_LICENSE
    );
  }

  run('pnpm', ['lint']);
  run('pnpm', ['typecheck']);
  run('pnpm', ['exec', 'vitest', 'run']);
  // TypeScript does not remove outputs for source files that no longer exist.
  // Always build release artifacts from an empty, ignored output directory.
  rmSync(join(ROOT, 'lib'), { recursive: true, force: true });
  run('pnpm', ['build']);

  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const mitTempRoot = mkdtempSync(join(tmpdir(), 'linecraft-mit-'));
  const tempRoot = mkdtempSync(join(tmpdir(), 'linecraft-fll-'));
  try {
    cpSync(join(ROOT, 'lib'), join(mitTempRoot, 'lib'), { recursive: true });
    writeFileSync(
      join(mitTempRoot, 'package.json'),
      `${JSON.stringify(createMitPackageJson(sourcePackage, mitVersion), null, 2)}\n`
    );
    writeFileSync(join(mitTempRoot, 'README.md'), createMitReadme(sourceReadme));
    writeFileSync(join(mitTempRoot, 'LICENSE'), mitLicenseText);

    cpSync(join(ROOT, 'lib'), join(tempRoot, 'lib'), { recursive: true });
    writeFileSync(
      join(tempRoot, 'package.json'),
      `${JSON.stringify(sourcePackage, null, 2)}\n`
    );
    writeFileSync(join(tempRoot, 'README.md'), sourceReadme);
    writeFileSync(join(tempRoot, 'LICENSE'), fllLicenseText);

    const sourceBuildHash = hashDirectory(join(ROOT, 'lib'));
    if (
      sourceBuildHash !== hashDirectory(join(mitTempRoot, 'lib')) ||
      sourceBuildHash !== hashDirectory(join(tempRoot, 'lib'))
    ) {
      fail('MIT and FLL builds are not byte-for-byte synchronized');
    }

    const mitPack = pack(mitTempRoot);
    const fllPack = pack(tempRoot);
    const manifest = {
      sourceCommit: run('git', ['rev-parse', 'HEAD'], { capture: true }),
      policy: {
        legacy: { version: mitVersion, license: 'MIT' },
        latest: { version: fllVersion, license: FLL_LICENSE },
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

    if (publish) {
      const publishEnv = { LINECRAFT_DUAL_RELEASE: '1' };
      publishOrResume(
        sourcePackage.name,
        mitVersion,
        publishedMitLicense,
        'MIT',
        mitTarball,
        'legacy',
        publishEnv
      );
      publishOrResume(
        sourcePackage.name,
        fllVersion,
        publishedFllLicense,
        FLL_LICENSE,
        fllTarball,
        'latest',
        publishEnv
      );
      verifyPublishedPolicy(sourcePackage.name, mitVersion, fllVersion);
      console.log(`Published ${sourcePackage.name}@${mitVersion} (MIT/legacy)`);
      console.log(`Published ${sourcePackage.name}@${fllVersion} (FLL/latest)`);
    } else {
      console.log(`Prepared MIT legacy artifact: ${mitTarball}`);
      console.log(`Prepared FLL latest artifact: ${fllTarball}`);
      console.log('Dry run only; run `pnpm release` to publish both artifacts');
    }
  } finally {
    rmSync(mitTempRoot, { recursive: true, force: true });
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
