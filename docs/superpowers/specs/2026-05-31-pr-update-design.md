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
- `-y/--yes` + flags → non-interactive: update immediately, no confirmation.
- Flags without `-y` → show summary of changes, ask confirm before submitting.
- No flags → fetch current PR, display all current field values, print hint showing which flags to use.

```
  --title <text>               Update PR title
  --description <text>         Update PR description
  --target <branch>            Update destination branch
  --add-reviewer <username>    Add a reviewer (repeatable)
  --remove-reviewer <username> Remove a reviewer (repeatable)
  --close-source-branch / --no-close-source-branch
  -y, --yes                    Skip confirmation prompt
```

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
- No-flags path: fetch PR → print current field values + hint listing available flags, exit 0.
- With-flags path: fetch PR → resolve reviewer usernames → build patch → if patch empty print "Nothing to update", exit 0 → if `-y` skip confirm, else show change summary and confirm → call `updatePullRequest` → print success with PR link.

## Data Flow

### No flags (suggest mode)

```
fetch current PR (spinner)
  → print current values:
      Title:       <title>
      Description: <description>
      Target:      <destBranch>
      Reviewers:   <reviewerNames>
      Close source branch: <yes|no>
  → print hint:
      Run with flags to update, e.g.:
        --title "New title"
        --add-reviewer <username>
        ...
  → exit 0
```

### With flags (non-interactive: -y present)

```
fetch current PR (needed for reviewer merge)
  → resolve --add-reviewer / --remove-reviewer usernames to UUIDs (parallel)
  → buildReviewerPatch: merge current + add − remove
  → diffFields: collect all changed fields into patch
  → if patch empty: print "Nothing to update", exit 0
  → updatePullRequest(patch)
  → print success + PR link
```

### With flags (confirm: no -y)

```
fetch current PR
  → resolve reviewer usernames
  → buildReviewerPatch + diffFields
  → if patch empty: print "Nothing to update", exit 0
  → print change summary:
      Title:   "old" → "new"
      Target:  old → new
      ...
  → confirm? (default: false)
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
