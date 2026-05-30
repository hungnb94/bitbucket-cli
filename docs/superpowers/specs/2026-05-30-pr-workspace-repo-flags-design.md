# Design: `--workspace` and `--repo` flags for `pr` command

**Issue:** #10  
**Date:** 2026-05-30  
**Status:** Approved

## Summary

Add `--workspace <workspace>` and `--repo <repo>` flags to the `pr` command so users can explicitly specify the workspace and repository slug instead of relying on inference from the git remote. Both flags are defined on the parent `pr` command and apply to all subcommands.

## Motivation

- Users with forks or non-standard remote URLs need to specify the workspace or repository explicitly
- Enables scripted/CI usage where explicit values are preferred over inference

## Resolution Order

1. CLI flags (`--workspace`, `--repo`) — highest priority
2. Inferred from git remote origin — fallback

Each flag is independent: you can specify just `--workspace`, just `--repo`, or both.

## Architecture

### Flag placement

Both flags are added to the parent `pr` command in `src/commands/pr.ts`:

```ts
const pr = new Command('pr')
  .description('Manage pull requests')
  .option('--workspace <workspace>', 'Bitbucket workspace')
  .option('--repo <repo>', 'Bitbucket repository slug')
```

All subcommands (`list`, `view`, `diff`, `approve`, `decline`, `comment`, `create`) access them via closure: `getContext(pr.opts())`.

### `getContext()` changes

The existing `getContext()` helper gains an optional `flags` parameter:

```ts
function getContext(flags?: { workspace?: string; repo?: string }): { workspace: string; repo: string } {
  try {
    const inferred = (flags?.workspace && flags?.repo)
      ? null
      : getRepoContext()
    return {
      workspace: flags?.workspace ?? inferred!.workspace,
      repo:      flags?.repo      ?? inferred!.repo,
    }
  } catch (error) {
    console.error(chalk.red('✗') + ' ' + (error instanceof Error ? error.message : String(error)))
    process.exit(1) as never
  }
}
```

When both `--workspace` and `--repo` are provided, `getRepoContext()` is skipped entirely (no git subprocess). When only one is provided, `getRepoContext()` is called and the flag value is used for that field only.

### No changes to

- `src/pr/remote.ts` — `getRepoContext()` is unchanged
- `src/api/bitbucket.ts` — API layer is unchanged
- Subcommand action handlers — each just changes `getContext()` → `getContext(pr.opts())`

## Testing

Tests in `tests/commands/pr.test.ts` cover three cases per subcommand:

1. **Both flags provided** — API called with the given workspace and repository; `getRepoContext` not called
2. **One flag provided** — API called with the given workspace or repository + inferred value for the other field
3. **No flags** — existing behavior unchanged (already covered by existing tests)

## Files Changed

| File | Change |
|------|--------|
| `src/commands/pr.ts` | Add `.option()` to parent `pr` command; update `getContext()` signature; update all `getContext()` call sites |
| `tests/commands/pr.test.ts` | Add explicit-flags and partial-flags test cases for all subcommands |
