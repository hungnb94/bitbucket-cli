# Auth Edge Cases Design

**Date:** 2026-05-30
**Branch:** feature/auth

## Problem

The current `auth login` and `auth logout` commands do not handle several important edge cases:

- Running `auth login` when already authenticated silently overwrites credentials.
- Running `auth login` when credentials come from env vars proceeds normally, causing confusion.
- Running `auth logout` when not logged in silently does nothing.
- Running `auth logout` when credentials come from env vars removes the config file but leaves the user still authenticated via env vars.

## Solution Overview

Introduce a `getAuthState()` helper that returns structured information about _where_ credentials come from. All auth commands use this to make informed decisions. `getCredentials()` becomes a thin wrapper over `getAuthState()` to avoid duplicate logic.

---

## 1. `getAuthState()` helper

**Location:** `src/auth/config.ts`

```ts
export type AuthState =
  | { source: 'env'; credentials: Credentials }
  | { source: 'file'; credentials: Credentials }
  | { source: 'none' }

export function getAuthState(): AuthState
```

- Returns `source: 'env'` if both `BITBUCKET_EMAIL` and `BITBUCKET_API_TOKEN` env vars are set.
- Returns `source: 'file'` if credentials exist in the config file store.
- Returns `source: 'none'` if neither.

`getCredentials()` is refactored to delegate to `getAuthState()`:

```ts
export function getCredentials(): Credentials | null {
  const state = getAuthState()
  return state.source === 'none' ? null : state.credentials
}
```

Both `AuthState` and `getAuthState` are exported via `src/auth/index.ts`.

---

## 2. `auth login` edge cases

**Decision tree:**

```
auth login
  ├── source === 'env'  → error + exit(1)
  ├── source === 'file' → confirm re-authenticate → no: exit / yes: full login flow
  └── source === 'none' → full login flow (unchanged)
```

**Messages:**

- **Env vars block:**
  `✗ Credentials are set via environment variables (BITBUCKET_EMAIL, BITBUCKET_API_TOKEN). Unset them to use auth login.`

- **Already logged in confirm:**
  `Already logged in as <email>. Re-authenticate?` (default: false)

After confirm `yes`, the full existing flow runs: login guide is printed, then email + token are prompted.

---

## 3. `auth logout` edge cases

**Decision tree:**

```
auth logout
  ├── source === 'none' → error + exit(1)
  ├── source === 'env'  → error + exit(1)
  └── source === 'file' → confirm + clearCredentials() (unchanged)
```

**Messages:**

- **Not logged in:**
  `✗ Not logged in.`

- **Env vars block:**
  `✗ Credentials are set via environment variables. Unset BITBUCKET_EMAIL and BITBUCKET_API_TOKEN from your shell to log out.`

**Why env vars cannot be cleared:** Environment variables are injected by the parent shell process. A child process can read them but cannot write back to the parent shell's environment. Clearing them programmatically is not possible, so the correct behavior is to block and instruct the user.

---

## Files Changed

| File | Change |
|---|---|
| `src/auth/config.ts` | Add `AuthState` type, `getAuthState()`, refactor `getCredentials()` |
| `src/auth/index.ts` | Export `AuthState` and `getAuthState` |
| `src/commands/auth.ts` | Add edge case guards to `login` and `logout` actions |
