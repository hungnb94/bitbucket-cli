# Refactor: Split Files for Clean Architecture

**Date:** 2026-05-31  
**Branch:** feature/pr-update

## Overview

The current codebase has two god-class files:
- `src/api/bitbucket.ts` — all API calls in one file (230 lines)
- `src/commands/pr.ts` — all PR subcommands in one file (330 lines)

Refactor into focused, single-responsibility modules without changing any behavior.

## Target File Structure

```
src/
  api/
    client.ts       ← shared axios builder, withRetry, throwApiError, throwRetryError
    pr.ts           ← all PR API functions (migrated from bitbucket.ts)
    users.ts        ← getUserByUsername (placeholder for future use)
  commands/
    pr/
      index.ts      ← creates `pr` Command with --workspace/--repo, mounts subcommands
      list.ts       ← pr list
      view.ts       ← pr view
      diff.ts       ← pr diff
      approve.ts    ← pr approve
      decline.ts    ← pr decline
      comment.ts    ← pr comment
      create.ts     ← pr create
  pr/
    format.ts       ← (unchanged)
    remote.ts       ← (unchanged)
    types.ts        ← (unchanged)
    index.ts        ← (unchanged)
  commands/
    auth.ts         ← (unchanged)
  index.ts          ← (unchanged, updates import path to commands/pr/index.ts)
```

`src/api/bitbucket.ts` and `src/commands/pr.ts` are deleted after migration.

## Migration Plan

### `src/api/client.ts`
Extract from `bitbucket.ts`:
- `buildClient()`
- `withRetry()`
- `throwApiError()`
- `throwRetryError()`

### `src/api/pr.ts`
Move all exported API functions from `bitbucket.ts`:
- `listPullRequests`
- `getPullRequest`
- `getPullRequestDiffStat`
- `getPullRequestDiff`
- `approvePullRequest`
- `declinePullRequest`
- `postComment`
- `createPullRequest`

### `src/commands/pr/index.ts`
Extract from `commands/pr.ts`:
- `requireAuth()`
- `getContext()`
- `parseId()`
- `runPrAction()` (shared by approve/decline — keep here or move to a shared helpers file)
- Create and return the `pr` Command, import and mount each subcommand

### `src/commands/pr/*.ts` (one per subcommand)
Each file exports a single function `register(pr: Command): void` that defines and attaches the subcommand to the parent `pr` Command.

## Constraints

- Zero behavior change — all commands work identically after refactor.
- All existing tests pass.
- No new abstractions beyond what the split requires.
