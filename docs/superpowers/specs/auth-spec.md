# Auth Feature — Spec

**Last updated:** 2026-05-30  
**Status:** Implemented  
**Branch:** w2/feature/auth

---

## Overview

Authentication module for the Bitbucket CLI. Supports login via Atlassian API token (App Passwords deprecated and removed July 28, 2026), logout, and `whoami`. Credentials stored locally via `conf` library with environment variable override for CI use.

Auth uses **HTTP Basic Auth** (`email:apiToken` base64-encoded) for all API calls — both credential validation (`/user` endpoint) and the general HTTP client.

---

## Commands

```
bitbucket auth login     # interactive prompt, validates token, saves config
bitbucket auth logout    # prompts confirmation, deletes config
bitbucket auth whoami    # prints current user info from Bitbucket API
```

---

## Data Model

```ts
// src/auth/config.ts

type Credentials = {
  email: string
  apiToken: string
}

type AuthState =
  | { source: 'env';  credentials: Credentials }
  | { source: 'file'; credentials: Credentials }
  | { source: 'none' }
```

```ts
// src/auth/credentials.ts

type UserInfo = {
  username: string
  displayName: string
  accountId: string
}
```

---

## Config Storage

File: `~/.config/bitbucket-cli/config.json` (permissions: `600`)

```json
{
  "email": "user@example.com",
  "apiToken": "xxxxxxxxxxxx"
}
```

Environment variable override (takes precedence over config file, for CI):
- `BITBUCKET_EMAIL`
- `BITBUCKET_API_TOKEN`

---

## Project Structure

```
src/
├── commands/
│   └── auth.ts           # commander subcommands: login, logout, whoami
├── auth/
│   ├── index.ts          # public API export
│   ├── credentials.ts    # validate credentials against Bitbucket API (/user endpoint)
│   └── config.ts         # read/write config via conf library; AuthState logic
└── api/
    └── bitbucket.ts      # HTTP client — uses Basic Auth via buildBasicAuth()
```

---

## Module Interface

```ts
// src/auth/config.ts
export function getAuthState(): AuthState
export function getCredentials(): Credentials | null   // thin wrapper over getAuthState()
export function saveCredentials(creds: Credentials): void
export function clearCredentials(): void
export function getConfigPath(): string

// src/auth/credentials.ts
export function buildBasicAuth(email: string, apiToken: string): string
export async function validateCredentials(creds: { email: string; apiToken: string }): Promise<UserInfo>

// src/auth/index.ts — re-exports everything above
export type { Credentials, AuthState, UserInfo }
```

---

## Auth State

`getAuthState()` is the single source of truth for credential resolution:

- Returns `source: 'env'` if both `BITBUCKET_EMAIL` and `BITBUCKET_API_TOKEN` are set.
- Returns `source: 'file'` if credentials exist in the config file store.
- Returns `source: 'none'` if neither source has credentials.

All auth commands use `getAuthState()` directly to make decisions based on credential source.

---

## HTTP Basic Auth

```ts
function buildBasicAuth(email: string, apiToken: string): string {
  return 'Basic ' + Buffer.from(`${email}:${apiToken}`).toString('base64')
}
```

Used in:
- `validateCredentials()` — `GET /user` call during login and `whoami`
- `createClient()` in `src/api/bitbucket.ts` — all other API calls

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

? Email: user@example.com
? API token: **********************

  Verifying credentials...
✓ Verified — welcome John Doe
✓ Credentials saved to ~/.config/bitbucket-cli/config.json
```

### Login edge cases

**Decision tree:**

```
auth login
  ├── source === 'env'  → error + exit(1)
  ├── source === 'file' → confirm re-authenticate → no: exit / yes: full login flow
  └── source === 'none' → full login flow
```

- **Env vars set:** `✗ Credentials are set via environment variables (BITBUCKET_EMAIL, BITBUCKET_API_TOKEN). Unset them to use auth login.`
- **Already logged in:** `Already logged in as <email>. Re-authenticate?` (default: false) — if yes, runs full login flow.
- **Verification failure:** spinner fails, prints error message + hint to re-run `auth login`, then `exit(1)`.

---

## Logout Flow

```
$ bitbucket auth logout

? Remove saved credentials? (y/N) y
✓ Removed ~/.config/bitbucket-cli/config.json
```

### Logout edge cases

**Decision tree:**

```
auth logout
  ├── source === 'none' → error + exit(1)
  ├── source === 'env'  → error + exit(1)
  └── source === 'file' → confirm + clearCredentials()
```

- **Not logged in:** `✗ Not logged in.`
- **Env vars set:** `✗ Credentials are set via environment variables. Unset BITBUCKET_EMAIL and BITBUCKET_API_TOKEN from your shell to log out.`

Environment variables cannot be cleared programmatically — a child process cannot write back to the parent shell environment — so the correct behavior is to block and instruct the user.

---

## Whoami

```
$ bitbucket auth whoami

  Username:     johndoe
  Display name: John Doe
  Account ID:   557058:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

If not logged in:
```
✗ Not logged in. Run: bitbucket auth login
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| 401 Unauthorized | Spinner fails with `401 Unauthorized`, prompts to re-run `auth login` |
| 403 Forbidden | `403 Forbidden: token missing required scopes, check your token scopes` |
| Network timeout | Retry once automatically, then fail with `Connection failed after retry.` |
| Config not found | Prompt to run `auth login` |
| Env vars block login | Error + `exit(1)`, no prompt shown |
| Env vars block logout | Error + `exit(1)`, no prompt shown |

---

## Security

- API token stored plain text in user config directory (same approach as `gh` CLI)
- Config file permissions set to `600` on creation
- Never log token to stdout/stderr
- Env var credentials never written to config file

---

## Tests

- `tests/auth/config.test.ts` — `getAuthState()`, `getCredentials()`, `saveCredentials()`, `clearCredentials()`; uses `email` (not `username`); no workspace/repo assertions
- `tests/auth/credentials.test.ts` — `mockCreds` uses `{ email, apiToken }`; Authorization header asserted as `Basic <base64>`; all error-path tests (401, 403, timeout + retry)
- `tests/commands/auth.test.ts` — login/logout/whoami flows; edge case guards (env vars, already-logged-in re-auth); no workspace/repo prompt interactions

---

## Dependencies

| Package | Version | Role |
|---|---|---|
| `commander` | v15 | CLI framework — subcommand definitions |
| `@inquirer/prompts` | v8 | Interactive prompts (input, password, confirm) |
| `ora` | v9 | Spinner for async operations |
| `conf` | v15 | Config file storage with typed schema |
| `axios` | current | HTTP client for Bitbucket API calls |
| `chalk` | current | Terminal color output |
