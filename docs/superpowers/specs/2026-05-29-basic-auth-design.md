# Basic Auth for fetchUser

**Date:** 2026-05-29  
**Scope:** Switch credential validation from Bearer token to Basic Auth (email + API token). Remove unused `defaultWorkspace` and `defaultRepo` fields.

---

## Data Model

`Credentials` in `src/auth/config.ts` is simplified to:

```ts
type Credentials = {
  email: string
  apiToken: string
}
```

- `username` is removed — the Bitbucket username is returned by the API and does not need to be stored.
- `defaultWorkspace` and `defaultRepo` are removed — not needed for current features.
- `getCredentials()` reads `email` from `BITBUCKET_EMAIL` env var (CI use) or the stored config key, and `apiToken` from `BITBUCKET_API_TOKEN` or stored config.
- Existing stored credentials (which have `username` but not `email`) will cause `getCredentials()` to return `null`. Users must re-run `auth login`.

---

## fetchUser / validateCredentials

`fetchUser` in `src/auth/credentials.ts` switches from Bearer to Basic Auth:

```ts
function buildBasicAuth(email: string, apiToken: string): string {
  return 'Basic ' + Buffer.from(`${email}:${apiToken}`).toString('base64')
}
```

The Authorization header becomes `Basic <base64(email:apiToken)>`.

`validateCredentials` signature changes:

```ts
// before
validateCredentials(creds: { username: string; apiToken: string }): Promise<UserInfo>

// after
validateCredentials(creds: { email: string; apiToken: string }): Promise<UserInfo>
```

Error handling is unchanged: 401 → "401 Unauthorized", 403 → scope error, timeout → one retry, then "Connection failed after retry".

`createClient()` in `src/api/bitbucket.ts` is **not changed** — it continues to use `Bearer ${apiToken}` for all other API calls.

---

## Login Flow

`src/commands/auth.ts` prompts only for email and API token:

```
? Email: user@example.com
? API token: ********
```

The workspace and repo prompts are removed. After successful validation, `saveCredentials({ email, apiToken })` is called.

`whoami` output is unchanged — username, display name, and account ID all come from the API response.

---

## Tests

- `credentials.test.ts`: `mockCreds` uses `{ email, apiToken }`. Authorization header assertion changes to `Basic <base64>`. All error-path tests unchanged.
- `config.test.ts`: removes workspace/repo assertions, uses `email` instead of `username`.
- `commands/auth.test.ts`: removes workspace/repo prompt interactions, uses email prompt.
