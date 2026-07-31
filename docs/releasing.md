# Publishing synchronized MIT and FLL releases

Linecraft publishes the same compiled implementation in two version lines:

- `0.2.x` is licensed under MIT and published with the npm `legacy` tag.
- `0.5.x` is licensed under FLL v1.2 and published with the npm `latest` tag.

The repository stays on the MIT 0.2.x line. Its root `LICENSE`, README license
section, version, and package metadata are all MIT. Do not replace those tracked
files to prepare an FLL release.

The release script copies the build into a temporary directory, then writes the
saved FLL release asset to that package's actual `LICENSE` path and substitutes
its version, package metadata, and README license section. The temporary package
is always removed after packing or publishing, including after failures.

## Prepare and inspect

Set root `package.json` to the intended MIT 0.2.x version, then pass the matching
leading FLL version explicitly:

```bash
pnpm release:dual --fll 0.5.7
```

This runs lint, typecheck, tests, and the build, then creates two tarballs and a
manifest under `.release/`. The command does not publish without `--publish`.

## Publish

Publishing requires npm authentication and a clean tracked worktree:

```bash
pnpm release:dual --fll 0.5.7 --publish
```

The script publishes in this fixed order:

1. MIT 0.2.x with `npm publish --tag legacy`
2. FLL 0.5.x with `npm publish --tag latest`

It then reads the npm metadata back and verifies that `legacy` is the requested
MIT 0.2.x version and `latest` is the requested FLL 0.5.x version. Direct
`npm publish` from the repository is blocked by `prepublishOnly`.

Published npm versions are immutable. The existing `0.2.6` package was
accidentally published with FLL metadata, so correct the compatibility line with
a new MIT `0.2.7` release rather than trying to replace `0.2.6`.

Known consumers pinned to `0.2.6` include Jess, Parser Thing/Parseman, and
Less.js-related worktrees. Update those pins deliberately after `0.2.7` exists.
