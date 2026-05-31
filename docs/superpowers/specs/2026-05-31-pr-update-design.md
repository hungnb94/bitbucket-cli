# PR Update Feature Design

**Date:** 2026-05-31  
**Branch:** feature/pr-update

## Overview

Add `bitbucket pr update <id>` subcommand to update an existing Bitbucket pull request. Supports all editable fields: title, description, target branch, reviewers (add/remove), and close-source-branch setting.

## CLI Interface

```
bitbucket pr update <id> [flags]

  --title <text>               Update PR title
  --description <text>         Update PR description
  --target <branch>            Update destination branch
  --add-reviewer <username>    Add a reviewer by Bitbucket username (repeatable)
  --remove-reviewer <username> Remove a reviewer by Bitbucket username (repeatable)
  --close-source-branch        Enable close-source-branch on merge
  --no-close-source-branch     Disable close-source-branch on merge

Global flags (inherited):
  --workspace <workspace>      Bitbucket workspace
  --repo <repo>                Repository slug
```

**Mode detection:**
- If at least one flag is passed → non-interactive mode: update immediately, no confirmation prompt.
- If no flags are passed → interactive mode: prompt each field with current value as default, show diff summary, ask for confirmation before submitting.

## Architecture

### File Structure

Refactor existing code and add new files:

```
src/
  api/
    client.ts       ← shared axios builder, withRetry, throwApiError
    pr.ts           ← all PR API functions (migrated from bitbucket.ts)
    users.ts        ← getUserByUsername (new)
  commands/
    pr/
      index.ts      ← creates `pr` Command, mounts all subcommands
      list.ts
      view.ts
      diff.ts
      approve.ts
      decline.ts
      comment.ts
      create.ts
      update.ts     ← new
  pr/
    update.ts       ← reviewer resolution + field diff logic (new)
    format.ts       ← (existing)
    remote.ts       ← (existing)
    types.ts        ← (existing)
    index.ts        ← (existing)
```

`src/api/bitbucket.ts` is deleted after migration; all consumers updated.

### API Layer

**`src/api/client.ts`**  
Exports: `buildClient()`, `withRetry()`, `throwApiError()`.

**`src/api/pr.ts`**  
Exports all existing PR functions plus:
- `updatePullRequest(workspace, repo, id, patch)` — `PUT /repositories/{ws}/{repo}/pullrequests/{id}`  
  `patch` contains only changed fields + full reviewer UUID list if reviewers changed.

**`src/api/users.ts`**  
- `getUserByUsername(username)` — `GET /users/{username}`, returns `{ uuid: string; displayName: string }`.  
  Throws a clear error if user not found (404).

### PR Logic Layer

**`src/pr/update.ts`**  
- `resolveReviewerUsernames(usernames: string[]): Promise<{ uuid: string }[]>` — fans out parallel `getUserByUsername` calls, collects results. Throws aggregated error if any username fails to resolve.
- `buildReviewerPatch(current: string[], addUsernames: string[], removeUsernames: string[]): Promise<{ uuid: string }[] | undefined>` — fetches UUIDs for add list, computes new set (current + add − remove), returns undefined if unchanged.
- `diffFields(current: PullRequest, input: UpdateInput): UpdatePatch` — compares input against current PR, returns only changed fields as a patch object. Returns empty object if nothing changed.

### Command Layer

**`src/commands/pr/update.ts`**  
- Non-interactive path: validate flags → fetch PR (to get current reviewer UUIDs for add/remove merge) → build patch → call `updatePullRequest` → print success with PR URL.
- Interactive path: fetch PR → prompt each field (title, description, target, add/remove reviewers, close-source-branch) with current values as defaults → diff against current → if nothing changed, print "Nothing to update" and exit → show change summary → confirm → call `updatePullRequest`.

## Data Flow

### Non-interactive

```
parse flags
  → fetch current PR (needed for reviewer merge)
  → resolve --add-reviewer / --remove-reviewer usernames to UUIDs (parallel)
  → buildReviewerPatch: merge current + add − remove
  → diffFields: collect all changed fields into patch
  → if patch empty: print "Nothing to update", exit 0
  → updatePullRequest(patch)
  → print success + PR link
```

### Interactive

```
fetch current PR (spinner)
  → prompt title       (default: current title)
  → prompt description (default: current description)
  → prompt target      (default: current destBranch)
  → prompt add-reviewers   (comma-separated, default: empty)
  → prompt remove-reviewers (comma-separated, default: empty)
  → prompt close-source-branch (default: current value)
  → diffFields
  → if nothing changed: print "Nothing to update", exit 0
  → show change summary table
  → confirm? (default: false)
  → resolve reviewer usernames
  → updatePullRequest(patch)
  → print success + PR link
```

## Error Handling

- Unknown reviewer username → clear error: `✗ Reviewer not found: <username>`
- Multiple unknown reviewers → list all failures in one message before exiting
- 409 from API (e.g. invalid target branch) → surface API message
- No fields changed → `Nothing to update.` (exit 0, not an error)

## Testing

- Unit tests for `diffFields` and `buildReviewerPatch` in `src/pr/update.ts`
- Unit tests for `updatePullRequest` in `src/api/pr.ts`
- Integration-style tests for the command handler in `src/commands/pr/update.ts` (mock API layer)
