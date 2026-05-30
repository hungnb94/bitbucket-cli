# bitbucket-cli

Bitbucket CLI tool for managing pull requests from the terminal. Requires Node.js ≥ 22.

## Prerequisites

- Node.js ≥ 22
- An Atlassian API token — create one at https://id.atlassian.com/manage-profile/security/api-tokens

## Installation

```bash
git clone <repo-url>
cd bitbucket-cli
yarn install
yarn build
yarn link
```

## Authentication

### Login

```console
$ bitbucket auth login

ℹ  You need to create an API token on Atlassian before continuing.

   Visit: https://id.atlassian.com/manage-profile/security/api-tokens

   Steps to create a token:
     1. Select "Create API token with scopes"
     2. Set a name and expiration date
     3. Select application: Bitbucket
     4. Select scopes as guided below
     5. Copy the token immediately — it is only shown once

   Minimum required scopes:
     ✓ User: Read                (to fetch account info)
     ✓ Repositories: Read        (to read repos, view diffs)
     ✓ Pull requests: Read       (to list/view PRs)
     ✓ Pull requests: Write      (to approve/decline/merge PRs, post comments)

? Email: user@example.com
? API token: **********************

  Verifying credentials...
✓ Verified — welcome John Doe
✓ Credentials saved to ~/.config/bitbucket-cli/config.json
```

### Logout

```console
$ bitbucket auth logout

? Remove saved credentials? (y/N) y
✓ Removed ~/.config/bitbucket-cli/config.json
```

### Whoami

```console
$ bitbucket auth whoami

  Username:     johndoe
  Display name: John Doe
  Account ID:   557058:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Pull Requests

All `pr` subcommands auto-detect the workspace and repository from the current directory's git remote.

### List

```console
$ bitbucket pr list
$ bitbucket pr list --state merged
$ bitbucket pr list --limit 50
```

Options:
- `--state <state>` — Filter by state: `open`, `merged`, `declined`, `all` (default: `open`)
- `--limit <n>` — Number of PRs to show (default: `20`)

### View

```console
$ bitbucket pr view 42
```

Shows PR details including title, state, author, reviewers, and changed files.

### Diff

```console
$ bitbucket pr diff 42
```

### Approve

```console
$ bitbucket pr approve 42
```

Prompts for confirmation before approving.

### Decline

```console
$ bitbucket pr decline 42
```

Prompts for confirmation before declining.

### Comment

```console
$ bitbucket pr comment 42 "Looks good!"
$ bitbucket pr comment 42 "Fix this" --file src/foo.ts --line 10
```

Options:
- `--file <path>` — File path for an inline comment (must be used with `--line`)
- `--line <n>` — Line number for an inline comment (must be used with `--file`)

## Configuration

Credentials are saved to `~/.config/bitbucket-cli/config.json` with permissions `600`.

For CI environments, set environment variables to skip the config file:

```console
BITBUCKET_EMAIL=user@example.com
BITBUCKET_API_TOKEN=your-token
```

Environment variables take precedence over the config file.
