# Bitbucket CLI Tool — Design Spec

---

## Overview

A TypeScript/Node.js CLI tool that connects to Bitbucket Cloud. Supports full PR workflow from the terminal — list, view, diff, approve, decline, comment, create, update.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| TypeScript + `tsup` | Language & build |
| `commander` | CLI framework (subcommands, flags, help) |
| `axios` | HTTP client for Bitbucket REST API |
| `chalk` | Terminal color output |
| `conf` | Config persistence at `~/.config/bitbucket-cli/` |
| `ora` | Loading spinners |

---

## Project Structure

```
bitbucket-cli/
├── src/
│   ├── index.ts              # entry point, CLI router
│   ├── commands/
│   │   ├── auth.ts           # login, logout, whoami
│   │   └── pr/
│   │       ├── index.ts      # createPrCommand(), registers all pr subcommands
│   │       ├── helpers.ts    # requireAuth, getContext, parseId
│   │       ├── approve.ts
│   │       ├── comment.ts
│   │       ├── create.ts
│   │       ├── decline.ts
│   │       ├── diff.ts
│   │       ├── list.ts
│   │       ├── update.ts
│   │       └── view.ts
│   ├── api/
│   │   ├── client.ts         # buildClient, withRetry, throwApiError
│   │   ├── pr.ts             # Bitbucket PR REST API methods
│   │   └── users.ts          # getUserByUsername
│   ├── auth/
│   │   ├── index.ts          # re-export public API
│   │   ├── config.ts         # read/write ~/.config/bitbucket-cli/config.json
│   │   └── credentials.ts    # validate credentials against Bitbucket API
│   └── pr/
│       ├── index.ts          # re-export public API
│       ├── remote.ts         # parse git remote origin → { workspace, repo }
│       ├── format.ts         # table, diff highlighting, pr view layout
│       ├── types.ts          # PullRequest type
│       └── update.ts         # UpdatePatch/UpdateInput types, field diff
├── package.json
├── tsconfig.json
└── README.md
```

---

## Authentication

### Config storage

Credentials saved to `~/.config/bitbucket-cli/config.json` via the `conf` library:

```json
{
  "email": "johndoe@example.com",
  "apiToken": "xxxxxxxxxxxx"
}
```

Uses Atlassian API tokens (App Passwords deprecated July 28, 2026). All API calls use HTTP Basic Auth (`email:apiToken` base64-encoded).

### Environment variable override

If `BITBUCKET_EMAIL` and `BITBUCKET_API_TOKEN` are set in the environment, they take precedence over the config file. Useful for CI.

### Commands

```
bitbucket auth login    # interactive prompt, saves to config
bitbucket auth logout   # deletes config file
bitbucket auth whoami   # prints current user info from API
```

**Login flow:**
```
? Email: user@example.com
? API token: **********************
✓ Credentials saved to ~/.config/bitbucket-cli/config.json
```

---

## PR Commands

All `pr` subcommands accept two flags on the parent command to override git remote inference:
- `--workspace <workspace>` — Bitbucket workspace
- `--repo <repo>` — Bitbucket repository slug

When both are provided, git remote inference is skipped entirely. Each flag is independent.

### `bitbucket pr list`

```
ID    Title                          Author    Status    Updated
----  -----------------------------  --------  --------  ----------
42    feat: android in-app update    hung      OPEN      2h ago
41    fix: crash on startup          minh      OPEN      1d ago
```

Flags:
- `--state open|merged|declined|all` (default: `open`)
- `--limit <n>` (default: 20)

### `bitbucket pr view <id>`

Displays: title, description, author, reviewers, status, additions/deletions, changed files count.

### `bitbucket pr diff <id>`

Prints raw diff to terminal with syntax highlighting.

### `bitbucket pr approve <id>` / `bitbucket pr decline <id>`

Prompts for confirmation before calling API:
```
? Approve PR #42 "feat: android in-app update"? (y/N)
```

### `bitbucket pr comment <id> <message>`

Posts a general comment on the PR.

Flags:
- `--file <path>` + `--line <n>` — post an inline comment on a specific line (both required together)

### `bitbucket pr create`

Source branch defaults to the current git branch but can be overridden with `--source`. Target branch defaults to `main` or `master` (auto-detected).

Flags:
- `--title <text>` — PR title (required)
- `--description <text>` — PR description
- `--source <branch>` — Source branch (default: current git branch)
- `--target <branch>` — Target branch (default: auto-detect `main`/`master`)
- `-y, --yes` — Skip confirmation prompt

### `bitbucket pr update <id>`

Updates an existing PR. With no flags, prints current values and flag hints. With flags, shows a change summary and prompts for confirmation.

Flags:
- `--title <text>` — Update PR title (cannot be empty)
- `--description <text>` — Update PR description
- `-y, --yes` — Skip confirmation prompt

---

## Error Handling

- Missing credentials → `✗ Not logged in. Run: bitbucket auth login`
- 403 Forbidden → `✗ 403 Forbidden: token missing required scopes.`
- Network timeout → retry once, then fail with `Connection failed after retry.`
- Not a git repo / no remote origin → `✗ Could not detect workspace/repo from git remote origin.`
- Remote not a Bitbucket URL → `✗ Remote origin is not a Bitbucket repository.`

---

## Security

- API token stored plain text in user config directory (same approach as `gh` CLI)
- Config file permissions set to `600` on creation
- Never log credentials to stdout/stderr
- PR IDs validated as integers before API calls
