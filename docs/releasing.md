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

For example, FLL `0.5.8` always produces MIT `0.2.8`. The dry run executes lint,
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
MIT 0.2.x version and `latest` is the requested FLL 0.5.x version. Verification
retries briefly because newly published npm metadata can return a transient 404
while registry caches converge. Direct `npm publish` from the repository is
blocked by `prepublishOnly`.

The command is resumable. Its preflight reads the existing `legacy` and `latest`
dist-tags rather than querying versions that have not been published yet. If a
tag already points to the requested version, the script validates that artifact's
license, restores the tag, and continues with the missing artifact. If npm reports
an unusual untagged immutable-version conflict, the script retries that existing
version's metadata and resumes only after validating its license. An existing
version with the wrong license is rejected.

Published npm versions are immutable. The existing `0.2.6` package was
accidentally published with FLL metadata. MIT `0.2.7` is the corrected
compatibility release; consumers should use it instead of `0.2.6`.
