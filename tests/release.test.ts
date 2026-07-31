import { describe, expect, it } from 'vitest';
import {
  assertVersionPolicy,
  createMitPackageJson,
  createMitReadme,
  deriveMitVersion,
  isImmutablePublishConflict,
  isTransientRegistryVerificationError,
  sanitizeNpmEnvironment,
  selectResumeVersions,
  validateExistingRelease,
} from '../scripts/release.js';

describe('dual-license release policy', () => {
  it('requires MIT on 0.2.x and FLL on 0.5.x', () => {
    expect(() => assertVersionPolicy('0.2.8', '0.5.8')).not.toThrow();
    expect(() => assertVersionPolicy('0.5.8', '0.5.9')).toThrow(
      'MIT releases must use the 0.2.x line'
    );
    expect(() => assertVersionPolicy('0.2.8', '0.2.9')).toThrow(
      'FLL releases must use the 0.5.x line'
    );
  });

  it('derives the synchronized MIT version from the main FLL patch version', () => {
    expect(deriveMitVersion('0.5.8')).toBe('0.2.8');
    expect(deriveMitVersion('0.5.9-beta.1')).toBe('0.2.9-beta.1');
    expect(() => deriveMitVersion('0.3.8')).toThrow(
      'FLL releases must use the 0.5.x line'
    );
  });

  it('creates MIT 0.2.x metadata from the main 0.5.x manifest', () => {
    const source = {
      name: 'linecraft',
      version: '0.5.8',
      license: 'LicenseRef-FLL-1.2',
    };

    expect(createMitPackageJson(source, '0.2.8')).toMatchObject({
      version: '0.2.8',
      license: 'MIT',
    });
    expect(source.version).toBe('0.5.8');
  });

  it('replaces only the staged MIT README license section', () => {
    const source = '# Linecraft\n\nContent\n\n## License\n\nFLL terms\n';
    const transformed = createMitReadme(source);

    expect(transformed).toContain('# Linecraft\n\nContent');
    expect(transformed).toContain('0.2.x compatibility release');
    expect(transformed).toContain('MIT License');
    expect(transformed).not.toContain('FLL terms');
  });

  it('resumes correctly published versions and rejects license mismatches', () => {
    expect(validateExistingRelease('linecraft@0.2.8', null, 'MIT')).toBe('publish');
    expect(validateExistingRelease('linecraft@0.2.8', 'MIT', 'MIT')).toBe('resume');
    expect(() =>
      validateExistingRelease('linecraft@0.2.8', 'LicenseRef-FLL-1.2', 'MIT')
    ).toThrow('linecraft@0.2.8 is already published with LicenseRef-FLL-1.2');
  });

  it('removes pnpm-only config before invoking npm', () => {
    const environment = sanitizeNpmEnvironment({
      PATH: '/bin',
      npm_config_registry: 'https://registry.npmjs.org/',
      npm_config__georiot_registry: 'https://npm.pkg.github.com/',
      npm_config__jsr_registry: 'https://npm.jsr.io/',
      npm_config_verify_deps_before_run: 'true',
    });

    expect(environment).toEqual({
      PATH: '/bin',
      npm_config_registry: 'https://registry.npmjs.org/',
    });
  });

  it('retries registry propagation failures but not policy failures', () => {
    expect(isTransientRegistryVerificationError(new Error('npm error code E404'))).toBe(true);
    expect(isTransientRegistryVerificationError(new Error('legacy must be 0.2.8 with MIT'))).toBe(true);
    expect(isTransientRegistryVerificationError(new Error('npm error code E401'))).toBe(false);
    expect(isTransientRegistryVerificationError(new Error('wrong license'))).toBe(false);
  });

  it('recognizes only immutable-version publish conflicts as resumable', () => {
    expect(
      isImmutablePublishConflict(
        'npm error You cannot publish over the previously published versions: 0.2.8.'
      )
    ).toBe(true);
    expect(isImmutablePublishConflict('npm error code EPUBLISHCONFLICT')).toBe(true);
    expect(isImmutablePublishConflict('npm error code E401 Unauthorized')).toBe(false);
    expect(isImmutablePublishConflict('npm error code EOTP')).toBe(false);
  });

  it('checks only versions that existing dist-tags identify as resumable', () => {
    expect(
      selectResumeVersions(
        { legacy: '0.2.7', latest: '0.5.7' },
        '0.2.8',
        '0.5.8'
      )
    ).toEqual({ mit: null, fll: null });
    expect(
      selectResumeVersions(
        { legacy: '0.2.8', latest: '0.5.7' },
        '0.2.8',
        '0.5.8'
      )
    ).toEqual({ mit: '0.2.8', fll: null });
  });

});
