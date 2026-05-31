# PR Update Command Design

**Date:** 2026-05-31  
**Branch:** feature/pr-update  
**Depends on:** `2026-05-31-refactor-file-structure-design.md`

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
  -y, --yes                    Skip confirmation prompt

Global flags (inherited):
  --workspace <workspace>      Bitbucket workspace
  --repo <repo>                Repository slug
```

**Mode detection:**
- No flags → fetch PR, display current values, print flag hints, exit 0.
- Flags + `-y` → update immediately, no confirmation.
- Flags without `-y` → show change summary, ask confirm before submitting.

## New Files

```
src/
  api/
    users.ts        ← getUserByUsername
  commands/
    pr/
      update.ts     ← pr update subcommand
  pr/
    update.ts       ← reviewer resolution + field diff logic
```

## API Layer

**`src/api/users.ts`**
- `getUserByUsername(username: string): Promise<{ uuid: string; displayName: string }>`  
  `GET /users/{username}`. Throws descriptive error on 404.

**`src/api/pr.ts`** — add:
- `updatePullRequest(workspace, repo, id, patch: UpdatePatch): Promise<{ id: number; links: { html: { href: string } } }>`  
  `PUT /repositories/{ws}/{repo}/pullrequests/{id}`. `patch` contains only changed fields; reviewer list is always sent as full UUID array when changed.

## PR Logic Layer

**`src/pr/update.ts`**

Types:
```ts
type UpdateInput = {
  title?: string
  description?: string
  target?: string
  addReviewers?: string[]
  removeReviewers?: string[]
  closeSourceBranch?: boolean
}

type UpdatePatch = {
  title?: string
  description?: string
  destination?: { branch: { name: string } }
  reviewers?: { uuid: string }[]
  close_source_branch?: boolean
}
```

Functions:
- `resolveReviewerUsernames(usernames: string[]): Promise<{ uuid: string }[]>` — parallel `getUserByUsername` calls; throws aggregated error listing all unknown usernames.
- `buildReviewerPatch(currentUuids: string[], addNames: string[], removeNames: string[]): Promise<{ uuid: string }[] | undefined>` — resolves add/remove names, computes new UUID set (current + add − remove), returns `undefined` if unchanged.
- `diffFields(current: PullRequest, input: UpdateInput, newReviewers?: { uuid: string }[]): UpdatePatch` — compares each field, returns only changed fields as API-shaped patch.

## Command Layer

**`src/commands/pr/update.ts`**

Three paths based on flags:

### No flags (suggest mode)
```
fetch current PR (spinner)
  → print current values:
      Title:               <title>
      Description:         <description>
      Target:              <destBranch>
      Reviewers:           <reviewerNames joined by ", ">
      Close source branch: yes | no
  → print hint:
      "Run with flags to update, e.g.:"
        --title "New title"
        --add-reviewer <username>
        --remove-reviewer <username>
        --target <branch>
        --close-source-branch / --no-close-source-branch
  → exit 0
```

### With flags, -y present (non-interactive)
```
fetch current PR
  → buildReviewerPatch (parallel username resolution)
  → diffFields
  → if patch empty: print "Nothing to update.", exit 0
  → updatePullRequest(patch)
  → print "PR #<id> updated: <url>"
```

### With flags, no -y (confirm)
```
fetch current PR
  → buildReviewerPatch + diffFields
  → if patch empty: print "Nothing to update.", exit 0
  → print change summary:
      Title:   "old title" → "new title"
      Target:  old-branch → new-branch
      ...
  → confirm? (default: false)
  → if not confirmed: print "Cancelled.", exit 0
  → updatePullRequest(patch)
  → print "PR #<id> updated: <url>"
```

## Error Handling

- Unknown reviewer username → `✗ Reviewer not found: <username>` (list all failures together before exit)
- Empty `--title` or `--target` → `✗ --title cannot be empty.`
- No fields changed → `Nothing to update.` (exit 0, not an error)
- API errors → surface via existing `throwApiError` pattern

## Testing

- Unit: `diffFields` — field-by-field change detection
- Unit: `buildReviewerPatch` — add/remove/unchanged cases
- Unit: `updatePullRequest` — correct PUT body shape
- Integration: command handler with mocked API — all three mode paths
