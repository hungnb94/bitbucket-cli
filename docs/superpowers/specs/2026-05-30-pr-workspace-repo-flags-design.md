# Design: `--workspace` and `--repo` flags for `pr` command

**Issue:** #10  
**Date:** 2026-05-30  
**Status:** Approved

## Summary

Add `--workspace <workspace>` and `--repo <repo>` flags to the `pr` command so users can explicitly override the workspace and repository slug inferred from the git remote. Both flags are defined on the parent `pr` command and apply to all subcommands.

## Motivation

- Users with forks or non-standard remote URLs need to override inferred values
- Enables scripted/CI usage where explicit values are preferred over inference

## Resolution Order

1. CLI flags (`--workspace`, `--repo`) — highest priority
2. Inferred from git remote origin — fallback

Each flag is independent: you can override just `--workspace`, just `--repo`, or both.

## Architecture

### Flag placement

Both flags are added to the parent `pr` command in `src/commands/pr.ts`:

```ts
const pr = new Command('pr')
  .description('Manage pull requests')
  .option('--workspace <workspace>', 'Override Bitbucket workspace')
  .option('--repo <repo>', 'Override Bitbucket repository slug')
```

All subcommands (`list`, `view`, `diff`, `approve`, `decline`, `comment`, `create`) access them via closure: `getContext(pr.opts())`.

### `getContext()` changes

The existing `getContext()` helper gains an optional `overrides` parameter:

```ts
function getContext(overrides?: { workspace?: string; repo?: string }): { workspace: string; repo: string } {
  try {
    const inferred = (overrides?.workspace && overrides?.repo)
      ? null
      : getRepoContext()
    return {
      workspace: overrides?.workspace ?? inferred!.workspace,
      repo:      overrides?.repo      ?? inferred!.repo,
    }
  } catch (error) {
    console.error(chalk.red('✗') + ' ' + (error instanceof Error ? error.message : String(error)))
    process.exit(1) as never
  }
}
```

When both flags are provided, `getRepoContext()` is skipped entirely (no git subprocess). When only one flag is provided, `getRepoContext()` is called and the override replaces the inferred value for that field only.

### No changes to

- `src/pr/remote.ts` — `getRepoContext()` is unchanged
- `src/api/bitbucket.ts` — API layer is unchanged
- Subcommand action handlers — each just changes `getContext()` → `getContext(pr.opts())`

## Testing

Tests in `tests/commands/pr.test.ts` cover three cases per subcommand:

1. **Both flags provided** — API called with flag values; `getRepoContext` not called
2. **Partial override** — one flag provided; API called with flag value + inferred value for the other field
3. **No flags** — existing behavior unchanged (already covered by existing tests)

## Files Changed

| File | Change |
|------|--------|
| `src/commands/pr.ts` | Add `.option()` to parent `pr` command; update `getContext()` signature; update all `getContext()` call sites |
| `tests/commands/pr.test.ts` | Add override and partial-override test cases for all subcommands |
