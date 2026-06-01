# PR Update Scope Reduction

**Date:** 2026-06-01  
**Status:** Approved

## Summary

Limit `pr update` to only support `--title` and `--description`. Remove `--target`, `--add-reviewer`, `--remove-reviewer`, and `--close-source-branch` / `--no-close-source-branch` options along with all supporting code.

## Changes

### `src/commands/pr/update.ts`

- Remove `.option('--target ...')`, `.option('--add-reviewer ...')`, `.option('--remove-reviewer ...')`, `.option('--close-source-branch')`, `.option('--no-close-source-branch')` registrations
- Simplify `UpdateOptions` interface to `{ title?: string; description?: string; yes?: boolean }`
- Simplify `hasFlags` to `options.title !== undefined || options.description !== undefined`
- Remove the `--target` empty-string validation block
- Remove the `buildReviewerPatch` call and `newReviewers` variable
- Remove `input.target`, `input.addReviewers`, `input.removeReviewers`, `input.closeSourceBranch` from the `UpdateInput` object literal
- No-flags display: remove target, reviewers, and close-source-branch lines; keep title and description only
- Confirmation display: remove destination, reviewers, and closeSourceBranch diff blocks
- Remove the `buildReviewerPatch` import

### `src/pr/update.ts`

- `UpdateInput`: remove fields `target`, `addReviewers`, `removeReviewers`, `closeSourceBranch`
- `UpdatePatch`: remove fields `destination`, `reviewers`, `closeSourceBranch`
- `diffFields`: remove the three conditional blocks that produce `patch.destination`, `patch.reviewers`, `patch.closeSourceBranch`
- Delete `buildReviewerPatch` function entirely
- Delete `resolveReviewerUsernames` function entirely
- Remove the `getUserByUsername` import (no longer needed)

### `src/api/users.ts`

- Remove any exported functions that exist solely to support reviewer username lookup, if they have no other callers

### Tests

- `tests/commands/pr.test.ts`: remove test cases for `--target`, `--add-reviewer`, `--remove-reviewer`, `--close-source-branch`
- `tests/api/users.test.ts`: remove test cases for deleted user-lookup functions

## Out of Scope

- No new options are added
- No changes to `pr create` or any other command
- No changes to the Bitbucket API client beyond what is forced by type cleanup
