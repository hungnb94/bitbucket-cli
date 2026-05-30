# Auth Edge Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Handle edge cases in `auth login` and `auth logout`: already-logged-in re-auth confirm, env-var credential blocking, and not-logged-in logout error.

**Architecture:** Introduce `getAuthState()` in `config.ts` as the single source of truth for credential origin (`'env' | 'file' | 'none'`). Refactor `getCredentials()` to delegate to it. Auth commands use `getAuthState()` to guard before proceeding.

**Tech Stack:** TypeScript, Vitest, commander, @inquirer/prompts, chalk

---

## File Map

| File | Change |
|---|---|
| `src/auth/config.ts` | Add `AuthState` type + `getAuthState()`, refactor `getCredentials()` to delegate |
| `src/auth/index.ts` | Export `AuthState` and `getAuthState` |
| `src/commands/auth.ts` | Add edge case guards to `login` and `logout` actions |
| `tests/auth/config.test.ts` | Add `getAuthState` tests, update env-var tests |
| `tests/commands/auth.test.ts` | Add `mockGetAuthState` to mock, add edge case tests, update existing tests |

---

### Task 1: Add `getAuthState()` to `config.ts` and refactor `getCredentials()`

**Files:**
- Modify: `src/auth/config.ts`
- Modify: `tests/auth/config.test.ts`

- [ ] **Step 1: Write failing tests for `getAuthState()`**

Add these tests to `tests/auth/config.test.ts`. Add `getAuthState` to the import at line 20:

```ts
const { getCredentials, saveCredentials, clearCredentials, getConfigPath, getAuthState } =
  await import('../../src/auth/config.js')
```

Add a new `afterEach` block to clean up env vars used in getAuthState tests. Place the `afterEach` at module level (outside any `describe`), above the existing `beforeEach`:

```ts
afterEach(() => {
  delete process.env.BITBUCKET_EMAIL
  delete process.env.BITBUCKET_API_TOKEN
})
```

Remove the existing `afterEach` inside `describe('env var override', ...)` since it's now handled at module level.

Add this describe block at the end of the file:

```ts
describe('getAuthState', () => {
  it('returns source:none when nothing is set', () => {
    expect(getAuthState()).toEqual({ source: 'none' })
  })

  it('returns source:none when only email env var is set', () => {
    process.env.BITBUCKET_EMAIL = 'env@example.com'
    expect(getAuthState()).toEqual({ source: 'none' })
  })

  it('returns source:none when only token env var is set', () => {
    process.env.BITBUCKET_API_TOKEN = 'env-token'
    expect(getAuthState()).toEqual({ source: 'none' })
  })

  it('returns source:env when both env vars are set', () => {
    process.env.BITBUCKET_EMAIL = 'env@example.com'
    process.env.BITBUCKET_API_TOKEN = 'env-token'
    expect(getAuthState()).toEqual({
      source: 'env',
      credentials: { email: 'env@example.com', apiToken: 'env-token' },
    })
  })

  it('returns source:env even when file creds also exist', () => {
    mockData['email'] = 'file@example.com'
    mockData['apiToken'] = 'file-token'
    process.env.BITBUCKET_EMAIL = 'env@example.com'
    process.env.BITBUCKET_API_TOKEN = 'env-token'
    expect(getAuthState()).toEqual({
      source: 'env',
      credentials: { email: 'env@example.com', apiToken: 'env-token' },
    })
  })

  it('returns source:file when file creds exist and no env vars', () => {
    mockData['email'] = 'file@example.com'
    mockData['apiToken'] = 'file-token'
    expect(getAuthState()).toEqual({
      source: 'file',
      credentials: { email: 'file@example.com', apiToken: 'file-token' },
    })
  })

  it('returns source:none when only email is in file', () => {
    mockData['email'] = 'file@example.com'
    expect(getAuthState()).toEqual({ source: 'none' })
  })

  it('returns source:none when only token is in file', () => {
    mockData['apiToken'] = 'file-token'
    expect(getAuthState()).toEqual({ source: 'none' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/auth/config.test.ts
```

Expected: FAIL with `getAuthState is not a function` or similar.

- [ ] **Step 3: Implement `getAuthState()` and refactor `getCredentials()` in `config.ts`**

Replace the contents of `src/auth/config.ts` with:

```ts
import Conf from 'conf'
import os from 'os'
import path from 'path'
import fs from 'fs'

export type Credentials = {
  email: string
  apiToken: string
}

export type AuthState =
  | { source: 'env'; credentials: Credentials }
  | { source: 'file'; credentials: Credentials }
  | { source: 'none' }

type Schema = Credentials

const store = new Conf<Schema>({
  projectName: 'bitbucket-cli',
  cwd: path.join(os.homedir(), '.config', 'bitbucket-cli'),
})

export function getAuthState(): AuthState {
  const envEmail = process.env.BITBUCKET_EMAIL
  const envToken = process.env.BITBUCKET_API_TOKEN
  if (envEmail && envToken) {
    return { source: 'env', credentials: { email: envEmail, apiToken: envToken } }
  }
  const fileEmail = store.get('email') as string | undefined
  const fileToken = store.get('apiToken') as string | undefined
  if (fileEmail && fileToken) {
    return { source: 'file', credentials: { email: fileEmail, apiToken: fileToken } }
  }
  return { source: 'none' }
}

export function getCredentials(): Credentials | null {
  const state = getAuthState()
  return state.source === 'none' ? null : state.credentials
}

export function saveCredentials(creds: Credentials): void {
  store.set('email', creds.email)
  store.set('apiToken', creds.apiToken)
  try {
    fs.chmodSync(store.path, 0o600)
  } catch {
    // chmod not supported on all platforms (e.g. Windows)
  }
}

export function clearCredentials(): void {
  store.clear()
}

export function getConfigPath(): string {
  return store.path
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/auth/config.test.ts
```

Expected: all tests PASS (existing + new `getAuthState` tests).

- [ ] **Step 5: Commit**

```bash
git add src/auth/config.ts tests/auth/config.test.ts
git commit -m "feat: add getAuthState() helper; refactor getCredentials() to delegate"
```

---

### Task 2: Export `getAuthState` and `AuthState` from `auth/index.ts`

**Files:**
- Modify: `src/auth/index.ts`

- [ ] **Step 1: Update exports**

Replace the contents of `src/auth/index.ts` with:

```ts
export {
  getCredentials,
  saveCredentials,
  clearCredentials,
  getConfigPath,
  getAuthState,
} from './config.js'
export type { Credentials, AuthState } from './config.js'

export { validateCredentials } from './credentials.js'
export type { UserInfo } from './credentials.js'
```

- [ ] **Step 2: Run all tests to verify no regressions**

```bash
npx vitest run
```

Expected: all 22+ tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/auth/index.ts
git commit -m "feat: export getAuthState and AuthState from auth public API"
```

---

### Task 3: Add edge case guards to `auth login`

**Files:**
- Modify: `src/commands/auth.ts`
- Modify: `tests/commands/auth.test.ts`

- [ ] **Step 1: Write failing tests for `auth login` edge cases**

In `tests/commands/auth.test.ts`, add `mockGetAuthState` to the mock and to the mock setup. Replace the mock declaration block (lines 4–16) with:

```ts
const mockGetAuthState = vi.fn()
const mockGetCredentials = vi.fn()
const mockSaveCredentials = vi.fn()
const mockClearCredentials = vi.fn()
const mockValidateCredentials = vi.fn()
const mockGetConfigPath = vi.fn().mockReturnValue('/mock/.config/bitbucket-cli/config.json')

vi.mock('../../src/auth/index.js', () => ({
  getAuthState: mockGetAuthState,
  getCredentials: mockGetCredentials,
  saveCredentials: mockSaveCredentials,
  clearCredentials: mockClearCredentials,
  validateCredentials: mockValidateCredentials,
  getConfigPath: mockGetConfigPath,
}))
```

Update the existing `auth login` tests to set `mockGetAuthState` returning `{ source: 'none' }` (since they test the happy path where no credentials exist):

```ts
describe('auth login', () => {
  it('saves credentials after successful validation', async () => {
    mockGetAuthState.mockReturnValueOnce({ source: 'none' })
    mockInput.mockResolvedValueOnce('user@example.com')
    mockPassword.mockResolvedValueOnce('my-token')
    mockValidateCredentials.mockResolvedValueOnce({
      username: 'johndoe',
      displayName: 'John Doe',
      accountId: '557058:xxxx',
    })

    await runCommand(['auth', 'login'])

    expect(mockSaveCredentials).toHaveBeenCalledWith({
      email: 'user@example.com',
      apiToken: 'my-token',
    })
  })

  it('does not save credentials when validation fails', async () => {
    mockGetAuthState.mockReturnValueOnce({ source: 'none' })
    mockInput.mockResolvedValueOnce('user@example.com')
    mockPassword.mockResolvedValueOnce('bad-token')
    mockValidateCredentials.mockRejectedValueOnce(new Error('401 Unauthorized'))

    await expect(runCommand(['auth', 'login'])).rejects.toThrow()

    expect(mockSaveCredentials).not.toHaveBeenCalled()
  })

  it('exits with error when credentials are set via env vars', async () => {
    mockGetAuthState.mockReturnValueOnce({
      source: 'env',
      credentials: { email: 'env@example.com', apiToken: 'env-token' },
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(runCommand(['auth', 'login'])).rejects.toThrow()

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('BITBUCKET_EMAIL')
    )
    expect(mockInput).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('proceeds to login when already logged in and user confirms re-auth', async () => {
    mockGetAuthState.mockReturnValueOnce({
      source: 'file',
      credentials: { email: 'file@example.com', apiToken: 'file-token' },
    })
    mockConfirm.mockResolvedValueOnce(true)   // re-auth confirm
    mockInput.mockResolvedValueOnce('file@example.com')
    mockPassword.mockResolvedValueOnce('new-token')
    mockValidateCredentials.mockResolvedValueOnce({
      username: 'johndoe',
      displayName: 'John Doe',
      accountId: '557058:xxxx',
    })

    await runCommand(['auth', 'login'])

    expect(mockSaveCredentials).toHaveBeenCalledWith({
      email: 'file@example.com',
      apiToken: 'new-token',
    })
  })

  it('aborts login when already logged in and user declines re-auth', async () => {
    mockGetAuthState.mockReturnValueOnce({
      source: 'file',
      credentials: { email: 'file@example.com', apiToken: 'file-token' },
    })
    mockConfirm.mockResolvedValueOnce(false)  // decline re-auth

    await runCommand(['auth', 'login'])

    expect(mockInput).not.toHaveBeenCalled()
    expect(mockSaveCredentials).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/commands/auth.test.ts
```

Expected: new edge case tests FAIL, existing tests may also fail due to missing `mockGetAuthState` setup.

- [ ] **Step 3: Implement guards in `auth login` action**

In `src/commands/auth.ts`, add `getAuthState` and `AuthState` to the import:

```ts
import {
  getCredentials,
  saveCredentials,
  clearCredentials,
  validateCredentials,
  getConfigPath,
  getAuthState,
} from '../auth/index.js'
```

Replace the `auth login` action (lines 42–64) with:

```ts
.action(async () => {
  const state = getAuthState()

  if (state.source === 'env') {
    console.error(
      chalk.red('✗') +
      ' Credentials are set via environment variables (BITBUCKET_EMAIL, BITBUCKET_API_TOKEN). Unset them to use auth login.'
    )
    process.exit(1)
  }

  if (state.source === 'file') {
    const reauth = await confirm({
      message: `Already logged in as ${state.credentials.email}. Re-authenticate?`,
      default: false,
    })
    if (!reauth) return
  }

  printLoginGuide()

  const email = await input({ message: 'Email:' })
  const apiToken = await password({ message: 'API token:', mask: '*' })

  const spinner = ora('Verifying credentials...').start()
  try {
    const userInfo = await validateCredentials({ email, apiToken })
    spinner.succeed(`Verified — welcome ${userInfo.displayName}`)
    saveCredentials({ email, apiToken })
    console.log(chalk.green('✓') + ` Credentials saved to ${getConfigPath()}`)
  } catch (error) {
    spinner.fail(
      'Verification failed — ' + (error instanceof Error ? error.message : 'Unknown error')
    )
    console.log(
      '  Check your email and API token, then run ' +
      chalk.cyan('bitbucket auth login')
    )
    process.exit(1)
  }
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/commands/auth.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/auth.ts tests/commands/auth.test.ts
git commit -m "feat: add edge case guards to auth login (env vars, already logged in)"
```

---

### Task 4: Add edge case guards to `auth logout`

**Files:**
- Modify: `src/commands/auth.ts`
- Modify: `tests/commands/auth.test.ts`

- [ ] **Step 1: Write failing tests for `auth logout` edge cases**

Update the existing `auth logout` tests and add new ones in `tests/commands/auth.test.ts`. Replace the existing `describe('auth logout', ...)` block with:

```ts
describe('auth logout', () => {
  it('clears credentials when user confirms', async () => {
    mockGetAuthState.mockReturnValueOnce({
      source: 'file',
      credentials: { email: 'file@example.com', apiToken: 'file-token' },
    })
    mockConfirm.mockResolvedValueOnce(true)

    await runCommand(['auth', 'logout'])

    expect(mockClearCredentials).toHaveBeenCalled()
  })

  it('does not clear credentials when user declines', async () => {
    mockGetAuthState.mockReturnValueOnce({
      source: 'file',
      credentials: { email: 'file@example.com', apiToken: 'file-token' },
    })
    mockConfirm.mockResolvedValueOnce(false)

    await runCommand(['auth', 'logout'])

    expect(mockClearCredentials).not.toHaveBeenCalled()
  })

  it('exits with error when not logged in', async () => {
    mockGetAuthState.mockReturnValueOnce({ source: 'none' })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(runCommand(['auth', 'logout'])).rejects.toThrow()

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Not logged in'))
    expect(mockClearCredentials).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('exits with error when credentials are set via env vars', async () => {
    mockGetAuthState.mockReturnValueOnce({
      source: 'env',
      credentials: { email: 'env@example.com', apiToken: 'env-token' },
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(runCommand(['auth', 'logout'])).rejects.toThrow()

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('BITBUCKET_EMAIL')
    )
    expect(mockClearCredentials).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/commands/auth.test.ts
```

Expected: new edge case tests FAIL, existing `clears/does not clear` tests may also fail due to missing `mockGetAuthState` setup.

- [ ] **Step 3: Implement guards in `auth logout` action**

Replace the `auth logout` action in `src/commands/auth.ts` (the `.action(async () => {` block under `auth logout`) with:

```ts
.action(async () => {
  const state = getAuthState()

  if (state.source === 'none') {
    console.error(chalk.red('✗') + ' Not logged in.')
    process.exit(1)
  }

  if (state.source === 'env') {
    console.error(
      chalk.red('✗') +
      ' Credentials are set via environment variables. Unset BITBUCKET_EMAIL and BITBUCKET_API_TOKEN from your shell to log out.'
    )
    process.exit(1)
  }

  const confirmed = await confirm({ message: 'Remove saved credentials?', default: false })
  if (confirmed) {
    clearCredentials()
    console.log(chalk.green('✓') + ` Removed ${getConfigPath()}`)
  }
})
```

- [ ] **Step 4: Run all tests to verify everything passes**

```bash
npx vitest run
```

Expected: all tests PASS with no failures.

- [ ] **Step 5: Commit**

```bash
git add src/commands/auth.ts tests/commands/auth.test.ts
git commit -m "feat: add edge case guards to auth logout (not logged in, env vars)"
```
