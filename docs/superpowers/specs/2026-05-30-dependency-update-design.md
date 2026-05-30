# Dependency Update Design

**Date:** 2026-05-30  
**Goal:** Update all outdated packages to their latest versions, fixing any breaking changes, one package at a time.

## Context

The project uses yarn@1.22.22 and has 7 packages with major version bumps available. All other packages (axios, chalk, tsup) are already current.

## Packages to Update

| Package | Current | Target | Type |
|---|---|---|---|
| `vitest` | 1.6.1 | 4.1.7 | devDependency |
| `@types/node` | 20.19.41 | 25.9.1 | devDependency |
| `ora` | 8.2.0 | 9.4.0 | dependency |
| `@inquirer/prompts` | 7.10.1 | 8.5.1 | dependency |
| `commander` | 12.1.0 | 15.0.0 | dependency |
| `conf` | 13.1.0 | 15.1.0 | dependency |
| `typescript` | 5.9.3 | 6.0.3 | devDependency |

## Approach

**Option B: Package-by-package, one commit each.** Ordered lowest-risk to highest-risk so failures are isolated and easy to attribute.

## Update Order & Rationale

1. **vitest** — test runner only, no runtime impact; upgrade path is well-documented
2. **@types/node** — type definitions only, no runtime impact
3. **ora** — spinner utility with small API surface; unlikely to affect logic
4. **@inquirer/prompts** — interactive prompts; API changes possible but scoped to `commands/auth.ts`
5. **commander** — CLI framework; breaking changes possible in command/option definitions
6. **conf** — config storage; API changes may affect `auth/config.ts`
7. **typescript** — compiler itself; strictness changes or removed features could require broad fixes

## Per-Package Process

For each package:
1. Update version range in `package.json` to `latest`
2. Run `yarn install`
3. Run `yarn build` — fix any TypeScript compilation errors
4. Run `yarn test` — fix any test failures
5. Commit with message: `chore: upgrade <package> to vX.Y.Z`

## Success Criteria

- `yarn build` completes with no errors
- `yarn test` passes all 3 test suites (auth/config, auth/credentials, commands/auth)
- `node dist/index.js --help` outputs expected CLI help without errors

## Fallback

If a package cannot be updated without excessive rework (e.g., a fundamentally redesigned API), pin it at its current version and note the reason in the commit message. Do not leave the codebase in a broken state.

## Files Likely Affected

- `src/auth/config.ts` — uses `conf`
- `src/commands/auth.ts` — uses `@inquirer/prompts`, `commander`
- `src/index.ts` — uses `commander`
- `tests/` — may need vitest config or API updates
