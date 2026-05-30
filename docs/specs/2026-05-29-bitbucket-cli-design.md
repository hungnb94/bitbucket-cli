# Bitbucket CLI Tool — Design Spec\

---

## Overview

A TypeScript/Node.js CLI tool published to npm that connects to Bitbucket Cloud. Supports full PR workflow from the terminal — list, view, diff, approve, decline, comment — plus AI-powered PR review via Claude Code.

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

**Distribution:** npm package, installed via `npm install -g bitbucket-cli`, invoked as `bitbucket`.

---

## Project Structure

```
bitbucket-cli/
├── src/
│   ├── index.ts              # entry point, CLI router
│   ├── commands/
│   │   ├── auth.ts           # login, logout, whoami
│   │   ├── pr.ts             # list, view, diff, approve, decline
│   │   ├── comment.ts        # post/list comments
│   │   └── review.ts         # AI review via Claude Code
│   ├── api/
│   │   └── bitbucket.ts      # Bitbucket REST API client (axios)
│   └── utils/
│       ├── config.ts         # read/write ~/.config/bitbucket-cli/config.json
│       └── format.ts         # format terminal output (tables, diffs)
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
  "username": "username",
  "appPassword": "xxxxxxxxxxxx",
  "defaultWorkspace": "workspace",
  "defaultRepo": "repo"
}
```

### Environment variable override

If `BITBUCKET_USERNAME` and `BITBUCKET_APP_PASSWORD` are set in the environment, they take precedence over the config file. Useful for CI.

### Commands

```
bitbucket auth login    # interactive prompt, saves to config
bitbucket auth logout   # deletes config file
bitbucket auth whoami   # prints current user info from API
```

**Login flow:**
```
? Bitbucket username: hung
? App Password: **********************
? Default workspace: bio-rithm
? Default repo (optional): femom_mobile_android
✓ Credentials saved to ~/.config/bitbucket-cli/config.json
```

---

## PR Commands

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

### `bitbucket pr comment <id> "message"`

Posts a general comment on the PR.

Flags:
- `--file <path>` + `--line <n>` — post an inline comment on a specific line

---

## Error Handling

- Missing credentials → prompt user to run `bitbucket auth login`
- API errors → display HTTP status + Bitbucket error message
- Network timeout → retry once, then fail with clear message

---

## Security

- App Password stored plain text in user config directory (same approach as `gh` CLI)
- Config file permissions set to `600` on creation
- Never log credentials to stdout/stderr
