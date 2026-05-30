# PR Create Command — Design Spec

**Date:** 2026-05-30  
**Status:** Approved  
**Branch:** feature/pr

---

## Overview

Adds `bitbucket pr create` to the existing `pr` command group. Source branch is auto-detected from the current git branch. Target branch defaults to `main` or `master` (auto-detected). Title is required; description is optional. Supports both interactive mode (confirmation preview) and non-interactive mode (`--yes` flag for scripting/CI).

---

## Command Interface

```
bitbucket pr create --title <title> [--description <text>] [--target <branch>] [--yes]
```

**Options:**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--title` | Yes | — | PR title |
| `--description` | No | (none) | PR description |
| `--target` | No | auto-detect | Target branch; auto-detects `main` then `master` |
| `--yes` / `-y` | No | false | Skip confirmation prompt (non-interactive) |

**Source branch:** auto-detected from `git branch --show-current`.

**Interactive mode (default):**
```
  Title:   feat: android in-app update
  Source:  feature/android-update → main
  Desc:    Adds in-app update flow for Android.

? Create PR? (y/N)
✓ PR #43 created: https://bitbucket.org/ws/repo/pull-requests/43
```

**Non-interactive mode (`--yes`):**
```
✓ PR #43 created: https://bitbucket.org/ws/repo/pull-requests/43
```

---

## Module Changes

### `src/pr/remote.ts` — new helpers

```ts
export function getCurrentBranch(): string
// Runs `git branch --show-current`
// Throws if not a git repo or in detached HEAD state

export function detectDefaultTarget(): string
// Tries `main` first, falls back to `master`
// Throws if neither exists (user must pass --target)
```

### `src/api/bitbucket.ts` — new method

```ts
createPullRequest(
  workspace: string,
  repo: string,
  title: string,
  sourceBranch: string,
  targetBranch: string,
  description?: string
): Promise<{ id: number; links: { html: { href: string } } }>
```

Calls `POST /2.0/repositories/{workspace}/{repo}/pullrequests`.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `--title` not provided | Commander reports missing required option automatically |
| Detached HEAD / not in git repo | `✗ Could not detect current branch. Are you in a git repo?` + exit(1) |
| `--target` omitted and no `main`/`master` found | `✗ Could not detect default target branch. Use --target <branch>.` + exit(1) |
| Source branch == target branch | `✗ Source and target branch must be different.` + exit(1) |
| PR already exists for branch (409) | `✗ A PR already exists for this branch.` + exit(1) |
| Not authenticated | `✗ Not logged in. Run: bitbucket auth login` + exit(1) |
| User cancels confirm prompt (Ctrl+C) | exit(0), no error message |

---

## Tests

- `tests/pr/remote.test.ts` — add cases for `getCurrentBranch()` (normal, detached HEAD) and `detectDefaultTarget()` (main exists, master fallback, neither found)
- `tests/api/bitbucket-pr.test.ts` — add mocked axios for `createPullRequest()` (success, 409 conflict)
- `tests/commands/pr.test.ts` — add cases: happy path with confirm, happy path with `--yes`, missing `--title`, source == target, not logged in

---

## Security

- No new credential storage — reuses existing auth module
- PR ID from API response validated before display
- Branch names passed as JSON body fields, not URL path parameters — no injection risk
