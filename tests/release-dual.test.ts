import { describe, expect, it } from 'vitest';
import {
  assertVersionPolicy,
  createFllPackageJson,
  createFllReadme,
  parseArgs,
} from '../scripts/release-dual.js';

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

  it('creates FLL metadata without mutating the MIT source package', () => {
    const source = {
      name: 'linecraft',
      version: '0.2.7',
      license: 'MIT',
    };

    const transformed = createFllPackageJson(source, '0.5.7');

    expect(transformed).toMatchObject({
      version: '0.5.7',
      license: 'LicenseRef-FLL-1.2',
      licenses: [{ type: 'LicenseRef-FLL-1.2' }],
    });
    expect(source).toMatchObject({ version: '0.2.7', license: 'MIT' });
  });

  it('replaces only the staged FLL README license section', () => {
    const source = '# Linecraft\n\nContent\n\n## License\n\nMIT terms\n';
    const transformed = createFllReadme(source);

    expect(transformed).toContain('# Linecraft\n\nContent');
    expect(transformed).toContain('0.5.x release');
    expect(transformed).toContain('Fair Labor License');
    expect(transformed).not.toContain('MIT terms');
  });

  it('requires an explicit publish flag', () => {
    expect(parseArgs(['--fll', '0.5.7'])).toMatchObject({
      fllVersion: '0.5.7',
      publish: false,
    });
    expect(parseArgs(['--fll=0.5.7', '--publish'])).toMatchObject({
      fllVersion: '0.5.7',
      publish: true,
    });
  });
});
