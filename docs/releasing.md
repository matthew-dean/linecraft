# Publishing synchronized MIT and FLL releases

Linecraft publishes the same compiled implementation in two version lines:

- `0.2.x` is licensed under MIT and published with the npm `legacy` tag.
- `0.5.x` is licensed under FLL v1.2 and published with the npm `latest` tag.

The repository and every pull request stay on the leading FLL 0.5.x line. The
root `LICENSE`, README, version, and package metadata are all FLL. Direct
publishing is blocked so both synchronized artifacts always go through the
policy checks.

The release script copies the build into two temporary directories. The FLL
artifact retains the source metadata. The MIT artifact derives its 0.2.x
version and substitutes the saved MIT text at its actual `LICENSE` path, plus
MIT package metadata and README section. Temporary packages are always removed,
including after failures.

## Prepare and inspect

Set root `package.json` to the intended leading 0.5.x version. The release
script derives the MIT version by keeping the patch version synchronized:

```bash
pnpm release:dry-run
```

For example, FLL `0.5.7` always produces MIT `0.2.7`. The dry run executes lint,
typecheck, tests, and the build, then creates two tarballs and a manifest under
`.release/` without publishing.

## Publish

Publishing requires npm authentication and a clean tracked worktree:

```bash
pnpm release
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
