# Non-Interactive Mode for All Commands

**Issue:** #5  
**Date:** 2026-05-30

## Summary

Add non-interactive mode to `auth login`, `auth logout`, `pr approve`, and `pr decline` so they can be driven from CI/CD pipelines and automation scripts without human input.

## Helper: `resolveConfirm`

New file: `src/utils/confirm.ts`

```ts
export async function resolveConfirm(yes: boolean, message: string): Promise<boolean>
```

- `yes === true` → return `true` immediately, no prompt shown
- `yes === false` → call `confirm({ message, default: false })` from `@inquirer/prompts`

All three confirmation-based commands (`logout`, `pr approve`, `pr decline`) replace their `await confirm(...)` calls with `await resolveConfirm(options.yes, ...)`.

## `auth login`

New options:

| Flag | Description |
|---|---|
| `--email <email>` | Email address (non-interactive) |
| `--token <token>` | API token (non-interactive) |
| `--yes` | Overwrite existing credentials without prompting |

**Logic:**

1. `source === 'env'` → error (unchanged)
2. `source === 'file'` (already logged in):
   - No `--yes` → error: `Already logged in as <email>. Use --yes to overwrite.` + exit 1
   - With `--yes` → proceed to overwrite
3. `--email` and `--token` both present → skip `printLoginGuide()` and all prompts, validate immediately
4. Only one of `--email` / `--token` provided → error: `--email and --token must be used together` + exit 1
5. Neither flag → fall through to interactive prompts (unchanged behavior)

## `auth logout`

New option: `--yes` — skip the "Remove saved credentials?" confirmation prompt.

Uses `resolveConfirm(options.yes, 'Remove saved credentials?')`.

## `pr approve`

New option: `--yes` — skip fetch and confirmation, approve immediately.

- Without `--yes`: fetch PR, show confirm prompt (current behavior)
- With `--yes`: skip fetch entirely, go straight to `approvePullRequest()`

## `pr decline`

New option: `--yes` — skip fetch and confirmation, decline immediately.

- Without `--yes`: fetch PR, show confirm prompt (current behavior)
- With `--yes`: skip fetch entirely, go straight to `declinePullRequest()`

## Tests

| File | New test cases |
|---|---|
| `tests/utils/confirm.test.ts` | `resolveConfirm(true, ...)` skips prompt; `resolveConfirm(false, ...)` calls confirm |
| `tests/commands/auth.test.ts` | Non-interactive login success; login while logged in without `--yes` → exit 1; login with `--yes` overwrites; `--email` without `--token` → exit 1 |
| `tests/commands/pr.test.ts` | `approve --yes` skips fetch+confirm; `decline --yes` skips fetch+confirm; `logout --yes` skips confirm |
