# PR Commands — Design Spec

**Date:** 2026-05-30  
**Status:** Approved  
**Branch:** feature/pr

---

## Overview

Implements the `bitbucket pr` command group: `list`, `view`, `diff`, `approve`, `decline`, `comment`. Workspace and repo are auto-detected from the git remote origin of the current directory. No AI review (`pr review`) in scope.

---

## Project Structure

```
src/
├── commands/
│   ├── auth.ts           # (existing)
│   └── pr.ts             # thin Commander wiring for 6 pr subcommands
├── pr/
│   ├── index.ts          # re-export public API
│   ├── remote.ts         # parse git remote origin → { workspace, repo }
│   └── format.ts         # table, diff highlighting, pr view layout
├── api/
│   └── bitbucket.ts      # extended with PR API methods
└── index.ts              # addCommand(createPrCommand())
```

---

## Module Interface

### `src/pr/remote.ts`

```ts
export type RepoContext = { workspace: string; repo: string }

export function getRepoContext(): RepoContext
// Runs `git remote get-url origin`, parses HTTPS and SSH Bitbucket URLs.
// Throws with a descriptive message if:
//   - not a git repo / no remote origin
//   - remote is not a Bitbucket URL
```

Supported URL formats:
- `https://bitbucket.org/workspace/repo.git`
- `git@bitbucket.org:workspace/repo.git`

### `src/pr/format.ts`

```ts
export function formatPrList(prs: PullRequest[]): string
export function formatPrView(pr: PullRequest): string
export function formatDiff(diff: string): string
```

### `src/api/bitbucket.ts` — new PR methods

```ts
listPullRequests(workspace: string, repo: string, state: string, limit: number): Promise<PullRequest[]>
getPullRequest(workspace: string, repo: string, id: number): Promise<PullRequest>
getPullRequestDiff(workspace: string, repo: string, id: number): Promise<string>
approvePullRequest(workspace: string, repo: string, id: number): Promise<void>
declinePullRequest(workspace: string, repo: string, id: number): Promise<void>
postComment(workspace: string, repo: string, id: number, message: string, inline?: { path: string; line: number }): Promise<void>
```

---

## Commands

```
bitbucket pr list [--state open|merged|declined|all] [--limit <n>]
bitbucket pr view <id>
bitbucket pr diff <id>
bitbucket pr approve <id>
bitbucket pr decline <id>
bitbucket pr comment <id> <message> [--file <path> --line <n>]
```

### `pr list`

Default: `--state open`, `--limit 20`.

```
  ID    Title                          Author    Status    Updated
  ----  -----------------------------  --------  --------  ----------
  42    feat: android in-app update    hung      OPEN      2h ago
  41    fix: crash on startup          minh      DECLINED  1d ago
```

Status colors: OPEN = green, MERGED = blue, DECLINED = red.

### `pr view <id>`

```
  #42  feat: android in-app update
  ─────────────────────────────────────────────
  Author:     hung
  Reviewers:  minh, an
  Status:     OPEN
  Branch:     feature/android-update → main
  Changes:    +120 -34  ·  5 files

  Description:
  Adds in-app update flow for Android using Play Core library.
```

### `pr diff <id>`

Raw diff printed to stdout with color: `+` lines green, `-` lines red, hunk headers (`@@`) cyan. No pager.

### `pr approve <id>` / `pr decline <id>`

Confirmation prompt before API call:

```
? Approve PR #42 "feat: android in-app update"? (y/N)
✓ PR #42 approved
```

### `pr comment <id> <message>`

General comment:
```
✓ Comment posted on PR #42
```

Inline comment (`--file` and `--line` required together):
```
bitbucket pr comment 42 "nit" --file src/foo.ts --line 15
✓ Inline comment posted on src/foo.ts:15
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Not a git repo / no remote origin | `✗ Could not detect workspace/repo from git remote origin.` + exit(1) |
| Remote origin not a Bitbucket URL | `✗ Remote origin is not a Bitbucket repository.` + exit(1) |
| Not authenticated | `✗ Not logged in. Run: bitbucket auth login` + exit(1) |
| PR not found (404) | `✗ PR #<id> not found.` + exit(1) |
| 403 Forbidden | `✗ 403 Forbidden: token missing required scopes.` + exit(1) |
| `--file` without `--line` or vice versa | `✗ --file and --line must be used together.` + exit(1) |
| Network timeout | Retry once, then fail with `Connection failed after retry.` |

---

## Tests

- `tests/pr/remote.test.ts` — HTTPS and SSH URL parsing, invalid URL, non-Bitbucket remote
- `tests/pr/format.test.ts` — `formatPrList()` correct columns and colors, `formatDiff()` +/- line colors
- `tests/api/bitbucket-pr.test.ts` — mocked axios for each API method; general and inline comment
- `tests/commands/pr.test.ts` — happy path per subcommand; not-logged-in guard; invalid arg guards

---

## Security

- No new credential storage — reuses existing auth module
- PR IDs validated as integers before API calls to prevent injection via URL path
