# Auth Feature — Design Spec

**Date:** 2026-05-29
**Status:** Approved

---

## Overview

Authentication module for the Bitbucket CLI tool. Supports login via Atlassian API token (replaces deprecated App Passwords — removed July 28, 2026), logout, and `whoami`. Credentials stored locally via `conf` library with environment variable override for CI use.

---

## Commands

```
bitbucket auth login     # interactive prompt, validates token, saves config
bitbucket auth logout    # prompts confirmation, deletes config
bitbucket auth whoami    # prints current user info from Bitbucket API
```

---

## Login Flow

```
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
     ✓ Pull requests: Read       (to list/view PRs, post comments)
     ✓ Pull requests: Write      (to approve/decline/merge PRs)

   Optional scopes:
     • Repositories: Write       (if you want to create PRs later)
     • Pipelines: Read           (if you want to view CI/CD)

? Bitbucket username: johndoe
? API token: **********************
? Default workspace: my-team
? Default repo (optional): my-project

  Verifying credentials...
✓ Verified — welcome john.doe@example.com
✓ Credentials saved to ~/.config/bitbucket-cli/config.json
```

On failure:
```
✗ Verification failed — 401 Unauthorized
  Check your username and API token, then run bitbucket auth login
```

---

## Logout Flow

```
$ bitbucket auth logout

? Remove saved credentials? (y/N) y
✓ Removed ~/.config/bitbucket-cli/config.json
```

---

## Whoami

```
$ bitbucket auth whoami

  Username:     johndoe
  Email:        john.doe@example.com
  Display name: John Doe
  Account ID:   557058:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

If not logged in:
```
✗ Not logged in. Run: bitbucket auth login
```

---

## Config Storage

File: `~/.config/bitbucket-cli/config.json` (permissions: `600`)

```json
{
  "username": "johndoe",
  "apiToken": "xxxxxxxxxxxx",
  "defaultWorkspace": "my-team",
  "defaultRepo": "my-project"
}
```

Environment variable override (takes precedence over config file, useful for CI):
- `BITBUCKET_USERNAME`
- `BITBUCKET_API_TOKEN`

---

## Project Structure

```
src/
├── commands/
│   └── auth.ts           # commander subcommands: login, logout, whoami
├── auth/
│   ├── index.ts          # public API export
│   ├── credentials.ts    # validate token against Bitbucket API (/user endpoint)
│   └── config.ts         # read/write config via conf library
└── api/
    └── bitbucket.ts      # HTTP client — loads credentials from auth module
```

---

## Module Interface

```typescript
// src/auth/config.ts
getCredentials(): Credentials | null
saveCredentials(creds: Credentials): void
clearCredentials(): void

// src/auth/credentials.ts
// Calls GET https://api.bitbucket.org/2.0/user with Bearer token to verify
validateCredentials(creds: Credentials): Promise<UserInfo>

// src/auth/index.ts
export { getCredentials, saveCredentials, clearCredentials, validateCredentials }
export type { Credentials, UserInfo }
```

```typescript
type Credentials = {
  username: string
  apiToken: string
  defaultWorkspace: string
  defaultRepo?: string
}

type UserInfo = {
  username: string
  email: string
  displayName: string
  accountId: string
}
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| 401 Unauthorized | Print error, prompt to re-run `auth login` |
| Network timeout | Retry once, then fail with clear message |
| Config not found | Prompt to run `auth login` |
| Token missing required scopes | API returns 403 — show "token missing required scopes, check your token scopes" |

---

## Security

- API token stored plain text in user config directory (same approach as `gh` CLI)
- Config file permissions set to `600` on creation
- Never log token to stdout/stderr
- Env var credentials never written to config file
