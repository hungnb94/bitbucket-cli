# Dependency Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update 7 outdated packages to their latest major versions, one at a time, fixing any breaking changes and committing after each.

**Architecture:** Package-by-package update in order of risk (lowest first). Each package follows an identical process: bump version in `package.json`, install, build, test, fix errors, commit. **Fallback:** if a package cannot be updated without excessive rework, revert its version in `package.json`, run `yarn install`, and commit with message `chore: pin <package> at vX — <reason>`.

**Tech Stack:** yarn@1.22.22, TypeScript, tsup, vitest, commander, conf, ora, @inquirer/prompts

---

## Files in Scope

- `package.json` — version bumps
- `src/auth/config.ts` — uses `conf`
- `src/commands/auth.ts` — uses `@inquirer/prompts`, `commander`, `ora`
- `src/index.ts` — uses `commander`
- `tests/auth/config.test.ts` — uses vitest
- `tests/auth/credentials.test.ts` — uses vitest
- `tests/commands/auth.test.ts` — uses vitest, commander
- `vitest.config.ts` — vitest config

---

## Task 1: Upgrade vitest 1 → 4

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.ts` (if config API changed)
- Modify: `tests/auth/credentials.test.ts:6` (known breaking change)

- [ ] **Step 1: Update vitest in package.json**

In `package.json`, change:
```json
"vitest": "^1.6.0"
```
to:
```json
"vitest": "^4.1.7"
```

- [ ] **Step 2: Install**

```bash
yarn install
```

Expected: no errors, `node_modules/vitest` updated.

- [ ] **Step 3: Run build to confirm no type errors from vitest upgrade**

```bash
yarn build
```

Expected: `dist/index.js` produced with no errors.

- [ ] **Step 4: Run tests — expect possible failure in credentials.test.ts**

```bash
yarn test
```

In vitest 2+, `vi.mocked(value, true)` (the second `true` argument for deep mocking) was removed. If you see an error like `Expected 1 arguments, but got 2`, fix `tests/auth/credentials.test.ts:6`:

Change:
```ts
const mockedAxios = vi.mocked(axios, true)
```
To:
```ts
const mockedAxios = vi.mocked(axios)
```

Re-run after fixing:
```bash
yarn test
```

Expected: all 3 test suites pass.

- [ ] **Step 5: Commit**

```bash
git add package.json yarn.lock tests/auth/credentials.test.ts vitest.config.ts
git commit -m "chore: upgrade vitest to v4"
```

---

## Task 2: Upgrade @types/node 20 → 25

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update @types/node in package.json**

In `package.json`, change:
```json
"@types/node": "^20.0.0"
```
to:
```json
"@types/node": "^25.9.1"
```

- [ ] **Step 2: Install**

```bash
yarn install
```

Expected: no errors.

- [ ] **Step 3: Build**

```bash
yarn build
```

Expected: no errors. `@types/node` 25 targets Node.js 22+ APIs. The project only uses `os`, `path`, `fs`, `process`, `Buffer` — all stable across versions.

- [ ] **Step 4: Test**

```bash
yarn test
```

Expected: all suites pass without changes.

- [ ] **Step 5: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: upgrade @types/node to v25"
```

---

## Task 3: Upgrade ora 8 → 9

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update ora in package.json**

In `package.json`, change:
```json
"ora": "^8.0.0"
```
to:
```json
"ora": "^9.4.0"
```

- [ ] **Step 2: Install**

```bash
yarn install
```

- [ ] **Step 3: Build**

```bash
yarn build
```

Expected: no errors. The project uses `ora('text').start()`, `.succeed()`, `.fail()`, `.stop()` — all stable in ora 9.

- [ ] **Step 4: Test**

```bash
yarn test
```

The `tests/commands/auth.test.ts` mocks `ora` entirely:
```ts
vi.mock('ora', () => ({
  default: vi.fn(() => ({ start: vi.fn().mockReturnThis(), ... })),
}))
```
Expected: all suites pass without changes.

- [ ] **Step 5: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: upgrade ora to v9"
```

---

## Task 4: Upgrade @inquirer/prompts 7 → 8

**Files:**
- Modify: `package.json`
- Modify: `src/commands/auth.ts` (if prompt API changed)

- [ ] **Step 1: Update @inquirer/prompts in package.json**

In `package.json`, change:
```json
"@inquirer/prompts": "^7.0.0"
```
to:
```json
"@inquirer/prompts": "^8.5.1"
```

- [ ] **Step 2: Install**

```bash
yarn install
```

- [ ] **Step 3: Build**

```bash
yarn build
```

The project uses `input`, `password`, `confirm` from `@inquirer/prompts`. These are named exports that have been stable. Expected: no errors. If you see type errors around the `message` option shape, check the v8 changelog at `node_modules/@inquirer/prompts/CHANGELOG.md` and update the option objects in `src/commands/auth.ts` accordingly.

- [ ] **Step 4: Test**

```bash
yarn test
```

Expected: all suites pass. The prompts are fully mocked in tests.

- [ ] **Step 5: Commit**

```bash
git add package.json yarn.lock src/commands/auth.ts
git commit -m "chore: upgrade @inquirer/prompts to v8"
```

---

## Task 5: Upgrade commander 12 → 15

**Files:**
- Modify: `package.json`
- Modify: `src/index.ts` (if command API changed)
- Modify: `src/commands/auth.ts` (if command API changed)

- [ ] **Step 1: Update commander in package.json**

In `package.json`, change:
```json
"commander": "^12.0.0"
```
to:
```json
"commander": "^15.0.0"
```

- [ ] **Step 2: Install**

```bash
yarn install
```

- [ ] **Step 3: Build**

```bash
yarn build
```

The project uses: `new Command()`, `.name()`, `.description()`, `.version()`, `.addCommand()`, `.command()`, `.action()`, `.parse()` in `src/index.ts` and `src/commands/auth.ts`. These are the stable core commander APIs.

If you see TypeScript errors, check `node_modules/commander/typings/index.d.ts` for the updated signatures and adjust accordingly.

- [ ] **Step 4: Test**

```bash
yarn test
```

`tests/commands/auth.test.ts` uses `new Command()` and `.exitOverride()` / `.parseAsync()` directly. If `.exitOverride()` behavior changed (e.g., it now throws a different error type), update the test assertions from `rejects.toThrow()` to match the new error.

Expected: all suites pass.

- [ ] **Step 5: Commit**

Stage only files that were actually modified. At minimum `package.json` and `yarn.lock`; add source files only if you changed them:

```bash
git add package.json yarn.lock
# Also add if modified: src/index.ts src/commands/auth.ts
git commit -m "chore: upgrade commander to v15"
```

---

## Task 6: Upgrade conf 13 → 15

**Files:**
- Modify: `package.json`
- Modify: `src/auth/config.ts` (if Conf constructor or schema API changed)

- [ ] **Step 1: Update conf in package.json**

In `package.json`, change:
```json
"conf": "^13.0.0"
```
to:
```json
"conf": "^15.1.0"
```

- [ ] **Step 2: Install**

```bash
yarn install
```

- [ ] **Step 3: Build**

```bash
yarn build
```

The project uses `new Conf<Schema>({ projectName, cwd })` and `.get()`, `.set()`, `.clear()`, `.path`. Check `node_modules/conf/readme.md` for v15 breaking changes. If the generic `<Schema>` type parameter signature changed, update `src/auth/config.ts:18`:

```ts
const store = new Conf<Schema>({
  projectName: 'bitbucket-cli',
  cwd: path.join(os.homedir(), '.config', 'bitbucket-cli'),
})
```

Fix any type errors to match the new constructor signature.

- [ ] **Step 4: Test**

```bash
yarn test
```

`tests/auth/config.test.ts` mocks `conf` entirely, so test behavior is decoupled from the real Conf API. Expected: all suites pass.

- [ ] **Step 5: Commit**

```bash
git add package.json yarn.lock src/auth/config.ts
git commit -m "chore: upgrade conf to v15"
```

---

## Task 7: Upgrade TypeScript 5 → 6

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json` (if deprecated options removed)
- Modify: any `.ts` file with TypeScript 6 breakages

- [ ] **Step 1: Update typescript in package.json**

In `package.json`, change:
```json
"typescript": "^5.4.0"
```
to:
```json
"typescript": "^6.0.3"
```

- [ ] **Step 2: Install**

```bash
yarn install
```

- [ ] **Step 3: Read tsconfig.json to check for deprecated options**

```bash
cat tsconfig.json
```

TypeScript 6 removed several deprecated compiler options. Common ones that may need removal: `importsNotUsedAsValues`, `preserveValueImports`. If you see "Option 'X' has been removed" errors, delete those lines from `tsconfig.json`.

- [ ] **Step 4: Build**

```bash
yarn build
```

TypeScript 6 tightens some type checks. Common issues:
- Stricter narrowing — if you see unexpected type errors in narrowing expressions, add explicit type assertions
- Removed APIs — check the TypeScript 6.0 breaking changes at `node_modules/typescript/CHANGELOG.md` if you see unexpected errors

Fix any errors until the build succeeds.

- [ ] **Step 5: Test**

```bash
yarn test
```

Expected: all suites pass. Vitest compiles tests via esbuild (tsup), not tsc, so test type errors are rare at runtime.

- [ ] **Step 6: Final smoke test**

```bash
node dist/index.js --help
```

Expected output:
```
Usage: bitbucket [options] [command]

Bitbucket CLI tool

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  auth            Manage Bitbucket authentication
  help [command]  display help for command
```

- [ ] **Step 7: Commit**

```bash
git add package.json yarn.lock tsconfig.json
git commit -m "chore: upgrade typescript to v6"
```
