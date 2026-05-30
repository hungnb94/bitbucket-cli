# `--source` Flag for `pr create` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `--source <branch>` flag to `bitbucket pr create` so users can explicitly set the source branch instead of always relying on the current git branch.

**Architecture:** Add `--source <branch>` as an optional Commander option on `pr create`. When provided, skip `getCurrentBranch()` entirely and use the value directly. When omitted, behavior is unchanged. No other files change.

**Tech Stack:** TypeScript, Commander, Vitest

---

### Task 1: Write failing tests for `--source` flag

**Files:**
- Modify: `tests/commands/pr.test.ts`

- [ ] **Step 1: Add three new test cases inside the `describe('pr create', ...)` block (after line 349, before the closing `})`)**

  The existing `describe('pr create', ...)` block ends at line 350. Append these three tests before the closing `})`:

  ```ts
  it('uses --source branch instead of getCurrentBranch', async () => {
    mockCreatePullRequest.mockResolvedValue({
      id: 43,
      links: { html: { href: 'https://bitbucket.org/ws/repo/pull-requests/43' } },
    })
    await runCommand(['pr', 'create', '--title', 'feat: new', '--source', 'other-branch', '--yes'])
    expect(mockGetCurrentBranch).not.toHaveBeenCalled()
    expect(mockCreatePullRequest).toHaveBeenCalledWith(
      'myworkspace', 'myrepo', 'feat: new', 'other-branch', 'main', undefined
    )
  })

  it('exits with 1 when --source and --target are the same', async () => {
    await expect(
      runCommand(['pr', 'create', '--title', 'feat: new', '--source', 'main', '--target', 'main'])
    ).rejects.toThrow('process.exit(1)')
  })

  it('does not call getCurrentBranch when --source is provided even if getCurrentBranch would throw', async () => {
    mockGetCurrentBranch.mockImplementation(() => {
      throw new Error('Could not detect current branch. Are you in a git repo?')
    })
    mockCreatePullRequest.mockResolvedValue({
      id: 43,
      links: { html: { href: 'https://bitbucket.org/ws/repo/pull-requests/43' } },
    })
    await runCommand(['pr', 'create', '--title', 'feat: new', '--source', 'other-branch', '--yes'])
    expect(mockGetCurrentBranch).not.toHaveBeenCalled()
    expect(mockCreatePullRequest).toHaveBeenCalledWith(
      'myworkspace', 'myrepo', 'feat: new', 'other-branch', 'main', undefined
    )
  })
  ```

- [ ] **Step 2: Run the new tests to confirm they fail**

  ```bash
  yarn test tests/commands/pr.test.ts
  ```

  Expected: 3 new tests FAIL (2 with "Expected: not called / Received: called", 1 with "Expected: not called / Received: called")

---

### Task 2: Implement `--source` flag in `pr create`

**Files:**
- Modify: `src/commands/pr.ts`

- [ ] **Step 1: Add the `--source` option to the `pr create` command**

  In `src/commands/pr.ts`, find the `pr create` command definition (around line 229). Add the `--source` option after `--target`:

  ```ts
  .option('--target <branch>', 'Target branch (default: main or master)')
  .option('--source <branch>', 'Source branch (default: current branch)')
  ```

- [ ] **Step 2: Replace the `getCurrentBranch()` block with the conditional logic**

  Find this block (around lines 239–245):

  ```ts
  let sourceBranch: string
  try {
    sourceBranch = getCurrentBranch()
  } catch (error) {
    console.error(chalk.red('✗') + ' ' + (error instanceof Error ? error.message : String(error)))
    process.exit(1) as never
  }
  ```

  Replace it with:

  ```ts
  let sourceBranch: string
  if (options.source) {
    sourceBranch = options.source
  } else {
    try {
      sourceBranch = getCurrentBranch()
    } catch (error) {
      console.error(chalk.red('✗') + ' ' + (error instanceof Error ? error.message : String(error)))
      process.exit(1) as never
    }
  }
  ```

- [ ] **Step 3: Run all tests to confirm everything passes**

  ```bash
  yarn test
  ```

  Expected: all tests PASS, no failures.

- [ ] **Step 4: Commit**

  ```bash
  git add src/commands/pr.ts tests/commands/pr.test.ts
  git commit -m "feat(pr): add --source flag to pr create command (#8)"
  ```
