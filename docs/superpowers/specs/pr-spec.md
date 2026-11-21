# PR Commands — Design Spec

---

## Overview

Implements the `bitbucket pr` command group: `create`, `list`, `view`, `diff`, `approve`, `decline`, `comment`, `update`. Workspace and repo are auto-detected from the git remote origin of the current directory, or can be specified explicitly via `--workspace` and `--repo` flags on the parent `pr` command. No AI review (`pr review`) in scope.

---

## Project Structure

```
src/
├── commands/
│   ├── auth.ts           # (existing)
│   └── pr/
│       ├── index.ts      # createPrCommand(), registers all pr subcommands
│       ├── helpers.ts    # requireAuth, getContext, parseId
│       ├── approve.ts, comment.ts, create.ts, decline.ts
│       ├── diff.ts, list.ts, view.ts
│       └── update.ts     # pr update subcommand
├── pr/
│   ├── index.ts          # re-export public API
│   ├── remote.ts         # parse git remote origin → { workspace, repo }; branch helpers
│   ├── format.ts         # table, diff highlighting, pr view layout
│   ├── types.ts          # PullRequest type
│   └── update.ts         # UpdatePatch type, diffFields
├── api/
│   ├── client.ts         # buildClient, withRetry
│   └── pr.ts             # PR API methods
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

export function getCurrentBranch(): string
// Runs `git branch --show-current`
// Throws if not a git repo or in detached HEAD state

export function detectDefaultTarget(): string
// Tries `main` first, falls back to `master`
// Throws if neither exists (user must pass --target)
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
createPullRequest(
  workspace: string,
  repo: string,
  title: string,
  sourceBranch: string,
  targetBranch: string,
  description?: string
): Promise<{ id: number; links: { html: { href: string } } }>
// Calls POST /2.0/repositories/{workspace}/{repo}/pullrequests

listPullRequests(workspace: string, repo: string, state: string, limit: number): Promise<PullRequest[]>
getPullRequest(workspace: string, repo: string, id: number): Promise<PullRequest>
getPullRequestDiff(workspace: string, repo: string, id: number): Promise<string>
approvePullRequest(workspace: string, repo: string, id: number): Promise<void>
declinePullRequest(workspace: string, repo: string, id: number): Promise<void>
postComment(workspace: string, repo: string, id: number, message: string, inline?: { path: string; line: number }): Promise<void>
```

---

## Commands

The parent `pr` command accepts two flags that apply to all subcommands:

| Flag | Description |
|------|-------------|
| `--workspace <workspace>` | Bitbucket workspace (overrides git remote inference) |
| `--repo <repo>` | Bitbucket repository slug (overrides git remote inference) |

Each flag is independent. When both are provided, git remote inference is skipped entirely.

```
bitbucket pr [--workspace <ws>] [--repo <repo>] create --title <title> [--description <text>] [--source <branch>] [--target <branch>] [--reviewer <id>]... [--default-reviewers] [--yes]
bitbucket pr [--workspace <ws>] [--repo <repo>] list [--state open|merged|declined|all] [--limit <n>]
bitbucket pr [--workspace <ws>] [--repo <repo>] view <id>
bitbucket pr [--workspace <ws>] [--repo <repo>] diff <id>
bitbucket pr [--workspace <ws>] [--repo <repo>] approve <id> [-y]
bitbucket pr [--workspace <ws>] [--repo <repo>] decline <id> [-y]
bitbucket pr [--workspace <ws>] [--repo <repo>] comment <id> <message> [--file <path> --line <n>]
bitbucket pr [--workspace <ws>] [--repo <repo>] update <id> [--title <text>] [--description <text>] [--reviewer <id>]... [--default-reviewers] [-y]
```

### `pr create`

Source branch defaults to the current git branch but can be overridden with `--source`. Target branch defaults to `main` or `master` (auto-detected).

**Options:**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--title` | Yes | — | PR title |
| `--description` | No | (none) | PR description |
| `--source` | No | current branch | Source branch to create the PR from |
| `--target` | No | auto-detect | Target branch; auto-detects `main` then `master` |
| `--reviewer` | No | (none) | Reviewer uuid or account_id; repeatable |
| `--default-reviewers` | No | false | Add the repository's effective default reviewers, minus the author |
| `--yes` / `-y` | No | false | Skip confirmation prompt (non-interactive) |

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

**Options:**

| Flag | Description |
|---|---|
| `-y, --yes` | Skip fetch and confirmation, approve/decline immediately |

Interactive mode (default) — fetches PR title then prompts:

```
? Approve PR #42 "feat: android in-app update"? (y/N)
✓ PR #42 approved
```

Non-interactive mode (`--yes`) — skips fetch and confirmation:

```
$ bitbucket pr approve 42 --yes
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

### `pr update <id>`

With no flags, fetches the PR and prints current values with flag hints (exit 0). With flags, shows a change summary and prompts for confirmation before submitting. Use `-y` to skip the prompt.

**Options:**

| Flag | Description |
|------|-------------|
| `--title <text>` | Update PR title (cannot be empty) |
| `--description <text>` | Update PR description (empty string clears it) |
| `--reviewer <id>` | Add a reviewer by uuid or account_id; repeatable; existing reviewers are kept |
| `--default-reviewers` | Add the repository's default reviewers; existing reviewers are kept, the PR author is left out |
| `-y, --yes` | Skip confirmation prompt |

**No flags (suggest mode):**
```
  Title:               feat: android in-app update
  Description:         Adds in-app update flow for Android.

Run with flags to update, e.g.:
  --title "New title"
```

**Confirm mode (with flags, no `-y`):**
```
  Title:   "old title" → new title

? Update PR #42? (y/N)
✓ PR #42 updated: https://bitbucket.org/ws/repo/pull-requests/42
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `--title` not provided | Commander reports missing required option automatically |
| Detached HEAD / not in git repo | `✗ Could not detect current branch. Are you in a git repo?` + exit(1) |
| `--target` omitted and no `main`/`master` found | `✗ Could not detect default target branch. Use --target <branch>.` + exit(1) |
| Source branch == target branch | `✗ Source and target branch must be different.` + exit(1) |
| PR already exists for branch (409) | `✗ A PR already exists for this branch.` + exit(1) |
| Not a git repo / no remote origin | `✗ Could not detect workspace/repo from git remote origin.` + exit(1) |
| Remote origin not a Bitbucket URL | `✗ Remote origin is not a Bitbucket repository.` + exit(1) |
| Not authenticated | `✗ Not logged in. Run: bitbucket auth login` + exit(1) |
| PR not found (404) | `✗ PR #<id> not found.` + exit(1) |
| 403 Forbidden | `✗ 403 Forbidden: token missing required scopes.` + exit(1) |
| `--file` without `--line` or vice versa | `✗ --file and --line must be used together.` + exit(1) |
| Network timeout | Retry once, then fail with `Connection failed after retry.` |
| User cancels confirm prompt (Ctrl+C) | exit(0), no error message |
| `pr update` — empty `--title` | `✗ --title cannot be empty.` + exit(1) |
| `pr update` — no fields changed | `Nothing to update.` + exit(0) |
| `--reviewer` is not a uuid or account_id | `✗ Invalid reviewer ID "<value>". Use a uuid or an account_id.` + exit(1) |
| Default reviewers cannot be fetched | API error message + exit(1); no PR is created or updated |

---

## Tests

- `tests/pr/remote.test.ts` — HTTPS and SSH URL parsing, invalid URL, non-Bitbucket remote; `getCurrentBranch()` (normal, detached HEAD); `detectDefaultTarget()` (main exists, master fallback, neither found)
- `tests/pr/format.test.ts` — `formatPrList()` correct columns and colors, `formatDiff()` +/- line colors
- `tests/pr/update.test.ts` — `diffFields` (field-by-field change detection, empty patch, clear description)
- `tests/api/bitbucket-pr.test.ts` — mocked axios for each API method; `createPullRequest()` (success, 409 conflict); `updatePullRequest()` (success, 404); general and inline comment
- `tests/commands/pr.test.ts` — happy path per subcommand; happy path with `--yes`; not-logged-in guard; source == target; invalid arg guards; `pr update` suggest/non-interactive/confirm/cancelled/nothing-to-update/validation modes

---

## Security

- No new credential storage — reuses existing auth module
- PR IDs validated as integers before API calls to prevent injection via URL path
- PR ID from API response validated before display
- Branch names passed as JSON body fields, not URL path parameters — no injection risk
