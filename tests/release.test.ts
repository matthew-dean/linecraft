import { describe, expect, it } from 'vitest';
import {
  assertVersionPolicy,
  createMitPackageJson,
  createMitReadme,
  deriveMitVersion,
} from '../scripts/release.js';

describe('dual-license release policy', () => {
  it('requires MIT on 0.2.x and FLL on 0.5.x', () => {
    expect(() => assertVersionPolicy('0.2.7', '0.5.7')).not.toThrow();
    expect(() => assertVersionPolicy('0.5.7', '0.5.8')).toThrow(
      'MIT releases must use the 0.2.x line'
    );
    expect(() => assertVersionPolicy('0.2.7', '0.2.8')).toThrow(
      'FLL releases must use the 0.5.x line'
    );
  });

  it('derives the synchronized MIT version from the main FLL patch version', () => {
    expect(deriveMitVersion('0.5.7')).toBe('0.2.7');
    expect(deriveMitVersion('0.5.8-beta.1')).toBe('0.2.8-beta.1');
    expect(() => deriveMitVersion('0.3.7')).toThrow(
      'FLL releases must use the 0.5.x line'
    );
  });

  it('creates MIT 0.2.x metadata from the main 0.5.x manifest', () => {
    const source = {
      name: 'linecraft',
      version: '0.5.7',
      license: 'LicenseRef-FLL-1.2',
    };

    expect(createMitPackageJson(source, '0.2.7')).toMatchObject({
      version: '0.2.7',
      license: 'MIT',
    });
    expect(source.version).toBe('0.5.7');
  });

  it('replaces only the staged MIT README license section', () => {
    const source = '# Linecraft\n\nContent\n\n## License\n\nFLL terms\n';
    const transformed = createMitReadme(source);

    expect(transformed).toContain('# Linecraft\n\nContent');
    expect(transformed).toContain('0.2.x compatibility release');
    expect(transformed).toContain('MIT License');
    expect(transformed).not.toContain('FLL terms');
  });

});
