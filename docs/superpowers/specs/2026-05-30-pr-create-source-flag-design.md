# Design: `--source` flag for `pr create`

**Issue:** #8  
**Date:** 2026-05-30

## Summary

Add an optional `--source <branch>` flag to `bitbucket pr create` so users can explicitly specify the source branch instead of always defaulting to the current git branch.

## Motivation

Currently the source branch is always auto-detected via `getCurrentBranch()`. This fails in detached HEAD state and prevents scripting PRs from a branch other than the one currently checked out.

## Behavior

```
bitbucket pr create --title "feat: x" --source feature-x
```

- `--source <branch>` is optional. When omitted, behavior is unchanged: source branch is detected from `getCurrentBranch()`.
- When provided, the value is used directly — no local git validation is performed (the branch may only exist remotely; the Bitbucket API returns a clear error if it doesn't exist).
- The same-branch guard (`source === target`) still applies.
- The confirmation preview already prints `Source: <branch> → <target>` and requires no changes.

## Changes

### `src/commands/pr.ts`

Add one option to the `pr create` command:

```ts
.option('--source <branch>', 'Source branch (default: current branch)')
```

Replace the `getCurrentBranch()` block:

```ts
// Before
let sourceBranch: string
try {
  sourceBranch = getCurrentBranch()
} catch (error) {
  console.error(...)
  process.exit(1) as never
}

// After
let sourceBranch: string
if (options.source) {
  sourceBranch = options.source
} else {
  try {
    sourceBranch = getCurrentBranch()
  } catch (error) {
    console.error(...)
    process.exit(1) as never
  }
}
```

No other source files change.

## Tests

New cases in `tests/commands/pr.test.ts`:

| Case | Description |
|------|-------------|
| `--source` provided | Uses it as source; `getCurrentBranch` not called; `createPullRequest` called with correct branch |
| `--source` same as `--target` | Exits with 1 (same-branch guard) |
| `--source` provided, `getCurrentBranch` would throw | Command succeeds; `getCurrentBranch` not called |

Existing tests remain valid and unmodified — they already cover the no-`--source` path.
