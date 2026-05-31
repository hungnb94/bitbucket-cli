---
name: bitbucket-cli
description: >
  Complete guide for using the bitbucket-cli tool to manage Bitbucket pull requests from the terminal.
  Use this skill whenever the user asks about: creating PRs, listing/viewing/approving/declining/merging PRs,
  posting comments, diffing changes, authenticating with Bitbucket, or any `bitbucket` CLI command.
  Trigger on phrases like: "create a PR", "list PRs", "approve PR", "view diff", "comment on PR",
  "decline PR", "bitbucket login", "bitbucket auth", "bitbucket pull request".
---

# bitbucket-cli

A CLI tool to manage Bitbucket pull requests from the terminal. Requires Node.js ≥ 22.

## Install

```bash
npm install -g @hungnb94/bitbucket-cli
```

## Authentication

### Login (interactive)
```bash
bitbucket auth login
# prompts for email + API token
```

### Login (non-interactive)
```bash
bitbucket auth login --email user@example.com --token <api-token>
```

Get an API token at https://id.atlassian.com/manage-profile/security/api-tokens  
Required scopes: **User: Read**, **Repositories: Read**, **Pull requests: Read**, **Pull requests: Write**

### Other auth commands
```bash
bitbucket auth whoami   # show current logged-in user
bitbucket auth logout   # remove saved credentials
bitbucket auth logout --yes  # skip confirmation
```

### CI / environment variables
```bash
BITBUCKET_EMAIL=user@example.com
BITBUCKET_API_TOKEN=your-token
```
Env vars take precedence over `~/.config/bitbucket-cli/config.json`.

---

## Pull Requests

All `pr` commands auto-detect workspace and repo from the current directory's git remote.  
Override with `--workspace <ws>` and `--repo <repo>` if needed.

### List PRs
```bash
bitbucket pr list                    # open PRs (default)
bitbucket pr list --state merged     # merged | declined | all
bitbucket pr list --limit 50         # default: 20
```

### View PR details
```bash
bitbucket pr view 42
# shows title, state, author, reviewers, changed files
```

### Diff
```bash
bitbucket pr diff 42
```

### Approve
```bash
bitbucket pr approve 42        # prompts for confirmation
bitbucket pr approve 42 --yes  # skip prompt
```

### Decline
```bash
bitbucket pr decline 42
bitbucket pr decline 42 --yes
```

### Comment
```bash
bitbucket pr comment 42 "Looks good!"
bitbucket pr comment 42 "Fix this" --file src/foo.ts --line 10
# --file and --line must be used together for inline comments
```

### Create PR
```bash
bitbucket pr create --title "feat: add login page"

# Full options:
bitbucket pr create \
  --title "feat: add login page" \
  --source feature/login \
  --target develop \
  --description "Adds the login page with JWT auth" \
  --yes
```

Options:
- `--title` (required)
- `--source` — source branch (default: current branch)
- `--target` — target branch (default: auto-detected `main` or `master`)
- `--description` — PR description
- `-y, --yes` — skip confirmation prompt

---

## Tips

- Use `--yes` / `-y` on all commands to run non-interactively (useful in scripts/CI).
- The CLI reads git remote to detect workspace and repo automatically — run commands from inside the repo.
- Credentials are stored at `~/.config/bitbucket-cli/config.json` with `600` permissions.
