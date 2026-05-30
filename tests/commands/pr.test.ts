import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'

const mockGetCredentials = vi.fn()
vi.mock('../../src/auth/index.js', () => ({
  getCredentials: mockGetCredentials,
}))

const mockGetRepoContext = vi.fn()
const mockFormatPrList = vi.fn()
const mockFormatPrView = vi.fn()
const mockFormatDiff = vi.fn()
const mockGetCurrentBranch = vi.fn()
const mockDetectDefaultTarget = vi.fn()
const mockCreatePullRequest = vi.fn()
vi.mock('../../src/pr/index.js', () => ({
  getRepoContext: mockGetRepoContext,
  formatPrList: mockFormatPrList,
  formatPrView: mockFormatPrView,
  formatDiff: mockFormatDiff,
  getCurrentBranch: mockGetCurrentBranch,
  detectDefaultTarget: mockDetectDefaultTarget,
}))

const mockListPullRequests = vi.fn()
const mockGetPullRequest = vi.fn()
const mockGetPullRequestDiffStat = vi.fn()
const mockGetPullRequestDiff = vi.fn()
const mockApprovePullRequest = vi.fn()
const mockDeclinePullRequest = vi.fn()
const mockPostComment = vi.fn()
vi.mock('../../src/api/bitbucket.js', () => ({
  listPullRequests: mockListPullRequests,
  getPullRequest: mockGetPullRequest,
  getPullRequestDiffStat: mockGetPullRequestDiffStat,
  getPullRequestDiff: mockGetPullRequestDiff,
  approvePullRequest: mockApprovePullRequest,
  declinePullRequest: mockDeclinePullRequest,
  postComment: mockPostComment,
  createPullRequest: mockCreatePullRequest,
}))

const mockConfirm = vi.fn()
vi.mock('@inquirer/prompts', () => ({ confirm: mockConfirm }))

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}))

const { createPrCommand } = await import('../../src/commands/pr.js')

const CONTEXT = { workspace: 'myworkspace', repo: 'myrepo' }
const MOCK_PR = {
  id: 42,
  title: 'feat: update',
  authorName: 'hung',
  state: 'OPEN' as const,
  updatedOn: '2024-01-01T00:00:00.000Z',
  description: 'desc',
  reviewerNames: ['minh'],
  sourceBranch: 'feature/foo',
  destBranch: 'main',
}
const MOCK_DIFFSTAT = { additions: 10, deletions: 3, filesChanged: 2 }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`)
  })
  mockGetCredentials.mockReturnValue({ email: 'user@example.com', apiToken: 'token' })
  mockGetRepoContext.mockReturnValue(CONTEXT)
  mockGetCurrentBranch.mockReturnValue('feature/new-feature')
  mockDetectDefaultTarget.mockReturnValue('main')
})

async function runCommand(args: string[]): Promise<void> {
  const program = new Command()
  program.addCommand(createPrCommand())
  program.exitOverride()
  await program.parseAsync(['node', 'bitbucket', ...args])
}

describe('pr list', () => {
  it('calls listPullRequests with defaults and prints formatted output', async () => {
    mockListPullRequests.mockResolvedValue([MOCK_PR])
    mockFormatPrList.mockReturnValue('formatted list')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runCommand(['pr', 'list'])
    expect(mockListPullRequests).toHaveBeenCalledWith('myworkspace', 'myrepo', 'open', 20)
    expect(consoleSpy).toHaveBeenCalledWith('formatted list')
    consoleSpy.mockRestore()
  })

  it('exits with 1 when not logged in', async () => {
    mockGetCredentials.mockReturnValue(null)
    await expect(runCommand(['pr', 'list'])).rejects.toThrow('process.exit(1)')
  })

  it('exits with 1 when getRepoContext throws', async () => {
    mockGetRepoContext.mockImplementation(() => { throw new Error('not a bitbucket repo') })
    await expect(runCommand(['pr', 'list'])).rejects.toThrow('process.exit(1)')
  })

  it('uses --workspace and --repo flags when both provided, skipping getRepoContext', async () => {
    mockListPullRequests.mockResolvedValue([MOCK_PR])
    mockFormatPrList.mockReturnValue('formatted list')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runCommand(['pr', '--workspace', 'flagws', '--repo', 'flagrepo', 'list'])
    expect(mockGetRepoContext).not.toHaveBeenCalled()
    expect(mockListPullRequests).toHaveBeenCalledWith('flagws', 'flagrepo', 'open', 20)
    consoleSpy.mockRestore()
  })

  it('uses --workspace flag with inferred repo when only --workspace provided', async () => {
    mockListPullRequests.mockResolvedValue([MOCK_PR])
    mockFormatPrList.mockReturnValue('formatted list')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runCommand(['pr', '--workspace', 'flagws', 'list'])
    expect(mockGetRepoContext).toHaveBeenCalled()
    expect(mockListPullRequests).toHaveBeenCalledWith('flagws', 'myrepo', 'open', 20)
    consoleSpy.mockRestore()
  })

  it('uses --repo flag with inferred workspace when only --repo provided', async () => {
    mockListPullRequests.mockResolvedValue([MOCK_PR])
    mockFormatPrList.mockReturnValue('formatted list')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runCommand(['pr', '--repo', 'flagrepo', 'list'])
    expect(mockGetRepoContext).toHaveBeenCalled()
    expect(mockListPullRequests).toHaveBeenCalledWith('myworkspace', 'flagrepo', 'open', 20)
    consoleSpy.mockRestore()
  })
})

describe('pr view', () => {
  it('fetches PR and diffstat in parallel and prints formatted view', async () => {
    mockGetPullRequest.mockResolvedValue(MOCK_PR)
    mockGetPullRequestDiffStat.mockResolvedValue(MOCK_DIFFSTAT)
    mockFormatPrView.mockReturnValue('formatted view')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runCommand(['pr', 'view', '42'])
    expect(mockGetPullRequest).toHaveBeenCalledWith('myworkspace', 'myrepo', 42)
    expect(mockGetPullRequestDiffStat).toHaveBeenCalledWith('myworkspace', 'myrepo', 42)
    expect(consoleSpy).toHaveBeenCalledWith('formatted view')
    consoleSpy.mockRestore()
  })

  it('exits with 1 for non-integer id', async () => {
    await expect(runCommand(['pr', 'view', 'abc'])).rejects.toThrow('process.exit(1)')
  })

  it('uses --workspace and --repo flags when both provided, skipping getRepoContext', async () => {
    mockGetPullRequest.mockResolvedValue(MOCK_PR)
    mockGetPullRequestDiffStat.mockResolvedValue(MOCK_DIFFSTAT)
    mockFormatPrView.mockReturnValue('formatted view')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runCommand(['pr', '--workspace', 'flagws', '--repo', 'flagrepo', 'view', '42'])
    expect(mockGetRepoContext).not.toHaveBeenCalled()
    expect(mockGetPullRequest).toHaveBeenCalledWith('flagws', 'flagrepo', 42)
    consoleSpy.mockRestore()
  })

  it('uses --workspace flag with inferred repo when only --workspace provided', async () => {
    mockGetPullRequest.mockResolvedValue(MOCK_PR)
    mockGetPullRequestDiffStat.mockResolvedValue(MOCK_DIFFSTAT)
    mockFormatPrView.mockReturnValue('formatted view')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runCommand(['pr', '--workspace', 'flagws', 'view', '42'])
    expect(mockGetRepoContext).toHaveBeenCalled()
    expect(mockGetPullRequest).toHaveBeenCalledWith('flagws', 'myrepo', 42)
    consoleSpy.mockRestore()
  })

  it('uses --repo flag with inferred workspace when only --repo provided', async () => {
    mockGetPullRequest.mockResolvedValue(MOCK_PR)
    mockGetPullRequestDiffStat.mockResolvedValue(MOCK_DIFFSTAT)
    mockFormatPrView.mockReturnValue('formatted view')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runCommand(['pr', '--repo', 'flagrepo', 'view', '42'])
    expect(mockGetRepoContext).toHaveBeenCalled()
    expect(mockGetPullRequest).toHaveBeenCalledWith('myworkspace', 'flagrepo', 42)
    consoleSpy.mockRestore()
  })
})

describe('pr diff', () => {
  it('fetches and prints colored diff', async () => {
    mockGetPullRequestDiff.mockResolvedValue('raw diff')
    mockFormatDiff.mockReturnValue('colored diff')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runCommand(['pr', 'diff', '42'])
    expect(mockGetPullRequestDiff).toHaveBeenCalledWith('myworkspace', 'myrepo', 42)
    expect(consoleSpy).toHaveBeenCalledWith('colored diff')
    consoleSpy.mockRestore()
  })

  it('uses --workspace and --repo flags when both provided, skipping getRepoContext', async () => {
    mockGetPullRequestDiff.mockResolvedValue('raw diff')
    mockFormatDiff.mockReturnValue('colored diff')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runCommand(['pr', '--workspace', 'flagws', '--repo', 'flagrepo', 'diff', '42'])
    expect(mockGetRepoContext).not.toHaveBeenCalled()
    expect(mockGetPullRequestDiff).toHaveBeenCalledWith('flagws', 'flagrepo', 42)
    consoleSpy.mockRestore()
  })

  it('uses --workspace flag with inferred repo when only --workspace provided', async () => {
    mockGetPullRequestDiff.mockResolvedValue('raw diff')
    mockFormatDiff.mockReturnValue('colored diff')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runCommand(['pr', '--workspace', 'flagws', 'diff', '42'])
    expect(mockGetRepoContext).toHaveBeenCalled()
    expect(mockGetPullRequestDiff).toHaveBeenCalledWith('flagws', 'myrepo', 42)
    consoleSpy.mockRestore()
  })

  it('uses --repo flag with inferred workspace when only --repo provided', async () => {
    mockGetPullRequestDiff.mockResolvedValue('raw diff')
    mockFormatDiff.mockReturnValue('colored diff')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runCommand(['pr', '--repo', 'flagrepo', 'diff', '42'])
    expect(mockGetRepoContext).toHaveBeenCalled()
    expect(mockGetPullRequestDiff).toHaveBeenCalledWith('myworkspace', 'flagrepo', 42)
    consoleSpy.mockRestore()
  })
})

describe('pr approve', () => {
  it('shows confirm prompt then calls approve', async () => {
    mockGetPullRequest.mockResolvedValue(MOCK_PR)
    mockConfirm.mockResolvedValue(true)
    mockApprovePullRequest.mockResolvedValue(undefined)
    await runCommand(['pr', 'approve', '42'])
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('#42') })
    )
    expect(mockApprovePullRequest).toHaveBeenCalledWith('myworkspace', 'myrepo', 42)
  })

  it('does not call approve when user cancels', async () => {
    mockGetPullRequest.mockResolvedValue(MOCK_PR)
    mockConfirm.mockResolvedValue(false)
    await runCommand(['pr', 'approve', '42'])
    expect(mockApprovePullRequest).not.toHaveBeenCalled()
  })

  it('exits with 1 when approvePullRequest throws', async () => {
    mockGetPullRequest.mockResolvedValue(MOCK_PR)
    mockConfirm.mockResolvedValue(true)
    mockApprovePullRequest.mockRejectedValue(new Error('403 Forbidden'))
    await expect(runCommand(['pr', 'approve', '42'])).rejects.toThrow('process.exit(1)')
  })

  it('approves immediately with --yes without fetching PR or prompting', async () => {
    mockApprovePullRequest.mockResolvedValue(undefined)

    await runCommand(['pr', 'approve', '42', '--yes'])

    expect(mockGetPullRequest).not.toHaveBeenCalled()
    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockApprovePullRequest).toHaveBeenCalledWith('myworkspace', 'myrepo', 42)
  })

  it('exits with 1 when approvePullRequest throws with --yes', async () => {
    mockApprovePullRequest.mockRejectedValue(new Error('403 Forbidden'))
    await expect(runCommand(['pr', 'approve', '42', '--yes'])).rejects.toThrow('process.exit(1)')
  })

  it('uses --workspace and --repo flags when both provided, skipping getRepoContext', async () => {
    mockApprovePullRequest.mockResolvedValue(undefined)
    await runCommand(['pr', '--workspace', 'flagws', '--repo', 'flagrepo', 'approve', '42', '--yes'])
    expect(mockGetRepoContext).not.toHaveBeenCalled()
    expect(mockApprovePullRequest).toHaveBeenCalledWith('flagws', 'flagrepo', 42)
  })

  it('uses --workspace flag with inferred repo when only --workspace provided', async () => {
    mockApprovePullRequest.mockResolvedValue(undefined)
    await runCommand(['pr', '--workspace', 'flagws', 'approve', '42', '--yes'])
    expect(mockGetRepoContext).toHaveBeenCalled()
    expect(mockApprovePullRequest).toHaveBeenCalledWith('flagws', 'myrepo', 42)
  })

  it('uses --repo flag with inferred workspace when only --repo provided', async () => {
    mockApprovePullRequest.mockResolvedValue(undefined)
    await runCommand(['pr', '--repo', 'flagrepo', 'approve', '42', '--yes'])
    expect(mockGetRepoContext).toHaveBeenCalled()
    expect(mockApprovePullRequest).toHaveBeenCalledWith('myworkspace', 'flagrepo', 42)
  })
})

describe('pr decline', () => {
  it('shows confirm prompt then calls decline', async () => {
    mockGetPullRequest.mockResolvedValue(MOCK_PR)
    mockConfirm.mockResolvedValue(true)
    mockDeclinePullRequest.mockResolvedValue(undefined)
    await runCommand(['pr', 'decline', '42'])
    expect(mockDeclinePullRequest).toHaveBeenCalledWith('myworkspace', 'myrepo', 42)
  })

  it('exits with 1 when declinePullRequest throws', async () => {
    mockGetPullRequest.mockResolvedValue(MOCK_PR)
    mockConfirm.mockResolvedValue(true)
    mockDeclinePullRequest.mockRejectedValue(new Error('403 Forbidden'))
    await expect(runCommand(['pr', 'decline', '42'])).rejects.toThrow('process.exit(1)')
  })

  it('declines immediately with --yes without fetching PR or prompting', async () => {
    mockDeclinePullRequest.mockResolvedValue(undefined)

    await runCommand(['pr', 'decline', '42', '--yes'])

    expect(mockGetPullRequest).not.toHaveBeenCalled()
    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockDeclinePullRequest).toHaveBeenCalledWith('myworkspace', 'myrepo', 42)
  })

  it('exits with 1 when declinePullRequest throws with --yes', async () => {
    mockDeclinePullRequest.mockRejectedValue(new Error('403 Forbidden'))
    await expect(runCommand(['pr', 'decline', '42', '--yes'])).rejects.toThrow('process.exit(1)')
  })

  it('uses --workspace and --repo flags when both provided, skipping getRepoContext', async () => {
    mockDeclinePullRequest.mockResolvedValue(undefined)
    await runCommand(['pr', '--workspace', 'flagws', '--repo', 'flagrepo', 'decline', '42', '--yes'])
    expect(mockGetRepoContext).not.toHaveBeenCalled()
    expect(mockDeclinePullRequest).toHaveBeenCalledWith('flagws', 'flagrepo', 42)
  })

  it('uses --workspace flag with inferred repo when only --workspace provided', async () => {
    mockDeclinePullRequest.mockResolvedValue(undefined)
    await runCommand(['pr', '--workspace', 'flagws', 'decline', '42', '--yes'])
    expect(mockGetRepoContext).toHaveBeenCalled()
    expect(mockDeclinePullRequest).toHaveBeenCalledWith('flagws', 'myrepo', 42)
  })

  it('uses --repo flag with inferred workspace when only --repo provided', async () => {
    mockDeclinePullRequest.mockResolvedValue(undefined)
    await runCommand(['pr', '--repo', 'flagrepo', 'decline', '42', '--yes'])
    expect(mockGetRepoContext).toHaveBeenCalled()
    expect(mockDeclinePullRequest).toHaveBeenCalledWith('myworkspace', 'flagrepo', 42)
  })
})

describe('pr comment', () => {
  it('posts a general comment', async () => {
    mockPostComment.mockResolvedValue(undefined)
    await runCommand(['pr', 'comment', '42', 'looks good'])
    expect(mockPostComment).toHaveBeenCalledWith('myworkspace', 'myrepo', 42, 'looks good', undefined)
  })

  it('posts an inline comment when --file and --line provided', async () => {
    mockPostComment.mockResolvedValue(undefined)
    await runCommand(['pr', 'comment', '42', 'nit', '--file', 'src/foo.ts', '--line', '15'])
    expect(mockPostComment).toHaveBeenCalledWith(
      'myworkspace', 'myrepo', 42, 'nit', { path: 'src/foo.ts', line: 15 }
    )
  })

  it('exits with 1 when --file provided without --line', async () => {
    await expect(
      runCommand(['pr', 'comment', '42', 'nit', '--file', 'src/foo.ts'])
    ).rejects.toThrow('process.exit(1)')
  })

  it('exits with 1 when --line provided without --file', async () => {
    await expect(
      runCommand(['pr', 'comment', '42', 'nit', '--line', '15'])
    ).rejects.toThrow('process.exit(1)')
  })

  it('uses --workspace and --repo flags when both provided, skipping getRepoContext', async () => {
    mockPostComment.mockResolvedValue(undefined)
    await runCommand(['pr', '--workspace', 'flagws', '--repo', 'flagrepo', 'comment', '42', 'looks good'])
    expect(mockGetRepoContext).not.toHaveBeenCalled()
    expect(mockPostComment).toHaveBeenCalledWith('flagws', 'flagrepo', 42, 'looks good', undefined)
  })

  it('uses --workspace flag with inferred repo when only --workspace provided', async () => {
    mockPostComment.mockResolvedValue(undefined)
    await runCommand(['pr', '--workspace', 'flagws', 'comment', '42', 'looks good'])
    expect(mockGetRepoContext).toHaveBeenCalled()
    expect(mockPostComment).toHaveBeenCalledWith('flagws', 'myrepo', 42, 'looks good', undefined)
  })

  it('uses --repo flag with inferred workspace when only --repo provided', async () => {
    mockPostComment.mockResolvedValue(undefined)
    await runCommand(['pr', '--repo', 'flagrepo', 'comment', '42', 'looks good'])
    expect(mockGetRepoContext).toHaveBeenCalled()
    expect(mockPostComment).toHaveBeenCalledWith('myworkspace', 'flagrepo', 42, 'looks good', undefined)
  })
})

describe('pr create', () => {
  it('shows preview prompt then creates PR on confirm', async () => {
    mockConfirm.mockResolvedValue(true)
    mockCreatePullRequest.mockResolvedValue({
      id: 43,
      links: { html: { href: 'https://bitbucket.org/ws/repo/pull-requests/43' } },
    })
    await runCommand(['pr', 'create', '--title', 'feat: new feature'])
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Create PR?' })
    )
    expect(mockCreatePullRequest).toHaveBeenCalledWith(
      'myworkspace', 'myrepo', 'feat: new feature', 'feature/new-feature', 'main', undefined
    )
  })

  it('skips confirmation and creates PR when --yes is passed', async () => {
    mockCreatePullRequest.mockResolvedValue({
      id: 43,
      links: { html: { href: 'https://bitbucket.org/ws/repo/pull-requests/43' } },
    })
    await runCommand(['pr', 'create', '--title', 'feat: new feature', '--yes'])
    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockCreatePullRequest).toHaveBeenCalledWith(
      'myworkspace', 'myrepo', 'feat: new feature', 'feature/new-feature', 'main', undefined
    )
  })

  it('passes description to createPullRequest when --description is provided', async () => {
    mockCreatePullRequest.mockResolvedValue({
      id: 43,
      links: { html: { href: 'https://bitbucket.org/ws/repo/pull-requests/43' } },
    })
    await runCommand(['pr', 'create', '--title', 'feat: new', '--description', 'my desc', '--yes'])
    expect(mockCreatePullRequest).toHaveBeenCalledWith(
      'myworkspace', 'myrepo', 'feat: new', 'feature/new-feature', 'main', 'my desc'
    )
  })

  it('uses --target branch instead of auto-detected default', async () => {
    mockCreatePullRequest.mockResolvedValue({
      id: 43,
      links: { html: { href: 'https://bitbucket.org/ws/repo/pull-requests/43' } },
    })
    await runCommand(['pr', 'create', '--title', 'feat: new', '--target', 'develop', '--yes'])
    expect(mockDetectDefaultTarget).not.toHaveBeenCalled()
    expect(mockCreatePullRequest).toHaveBeenCalledWith(
      'myworkspace', 'myrepo', 'feat: new', 'feature/new-feature', 'develop', undefined
    )
  })

  it('exits with 1 when not logged in', async () => {
    mockGetCredentials.mockReturnValue(null)
    await expect(
      runCommand(['pr', 'create', '--title', 'feat: new'])
    ).rejects.toThrow('process.exit(1)')
  })

  it('exits with 1 when source and target branch are the same', async () => {
    mockGetCurrentBranch.mockReturnValue('main')
    await expect(
      runCommand(['pr', 'create', '--title', 'feat: new', '--target', 'main'])
    ).rejects.toThrow('process.exit(1)')
  })

  it('exits with 1 when getCurrentBranch throws', async () => {
    mockGetCurrentBranch.mockImplementation(() => {
      throw new Error('Could not detect current branch. Are you in a git repo?')
    })
    await expect(
      runCommand(['pr', 'create', '--title', 'feat: new'])
    ).rejects.toThrow('process.exit(1)')
  })

  it('does not call createPullRequest when user cancels confirmation', async () => {
    mockConfirm.mockResolvedValue(false)
    await runCommand(['pr', 'create', '--title', 'feat: new'])
    expect(mockCreatePullRequest).not.toHaveBeenCalled()
  })

  it('shows success message with PR id and URL', async () => {
    const mockSpinner = { start: vi.fn().mockReturnThis(), succeed: vi.fn().mockReturnThis(), fail: vi.fn().mockReturnThis(), stop: vi.fn().mockReturnThis() }
    const { default: mockOra } = await import('ora')
    vi.mocked(mockOra).mockReturnValueOnce(mockSpinner as any)
    mockCreatePullRequest.mockResolvedValue({
      id: 43,
      links: { html: { href: 'https://bitbucket.org/ws/repo/pull-requests/43' } },
    })
    await runCommand(['pr', 'create', '--title', 'feat: new feature', '--yes'])
    expect(mockSpinner.succeed).toHaveBeenCalledWith('PR #43 created: https://bitbucket.org/ws/repo/pull-requests/43')
  })

  it('exits with 1 when createPullRequest throws', async () => {
    mockCreatePullRequest.mockRejectedValue(new Error('A PR already exists for this branch.'))
    await expect(
      runCommand(['pr', 'create', '--title', 'feat: new', '--yes'])
    ).rejects.toThrow('process.exit(1)')
  })

  it('exits with 1 when detectDefaultTarget throws', async () => {
    mockDetectDefaultTarget.mockImplementation(() => {
      throw new Error('Could not detect default target branch. Use --target <branch>.')
    })
    await expect(
      runCommand(['pr', 'create', '--title', 'feat: new'])
    ).rejects.toThrow('process.exit(1)')
  })

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

  it('succeeds with --source when git branch detection is unavailable', async () => {
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

  it('exits with 1 when git detection fails and --source is not provided', async () => {
    mockGetCurrentBranch.mockImplementation(() => {
      throw new Error('Could not detect current branch. Are you in a git repo?')
    })
    await expect(
      runCommand(['pr', 'create', '--title', 'feat: new'])
    ).rejects.toThrow('process.exit(1)')
  })

  it('exits with 1 when --source is an empty string', async () => {
    await expect(
      runCommand(['pr', 'create', '--title', 'feat: new', '--source', ''])
    ).rejects.toThrow('process.exit(1)')
  })

  it('uses --workspace and --repo flags when both provided, skipping getRepoContext', async () => {
    mockCreatePullRequest.mockResolvedValue({
      id: 43,
      links: { html: { href: 'https://bitbucket.org/flagws/flagrepo/pull-requests/43' } },
    })
    await runCommand(['pr', '--workspace', 'flagws', '--repo', 'flagrepo', 'create', '--title', 'feat: new', '--yes'])
    expect(mockGetRepoContext).not.toHaveBeenCalled()
    expect(mockCreatePullRequest).toHaveBeenCalledWith(
      'flagws', 'flagrepo', 'feat: new', 'feature/new-feature', 'main', undefined
    )
  })

  it('uses --workspace flag with inferred repo when only --workspace provided', async () => {
    mockCreatePullRequest.mockResolvedValue({
      id: 43,
      links: { html: { href: 'https://bitbucket.org/flagws/myrepo/pull-requests/43' } },
    })
    await runCommand(['pr', '--workspace', 'flagws', 'create', '--title', 'feat: new', '--yes'])
    expect(mockGetRepoContext).toHaveBeenCalled()
    expect(mockCreatePullRequest).toHaveBeenCalledWith(
      'flagws', 'myrepo', 'feat: new', 'feature/new-feature', 'main', undefined
    )
  })

  it('uses --repo flag with inferred workspace when only --repo provided', async () => {
    mockCreatePullRequest.mockResolvedValue({
      id: 43,
      links: { html: { href: 'https://bitbucket.org/myworkspace/flagrepo/pull-requests/43' } },
    })
    await runCommand(['pr', '--repo', 'flagrepo', 'create', '--title', 'feat: new', '--yes'])
    expect(mockGetRepoContext).toHaveBeenCalled()
    expect(mockCreatePullRequest).toHaveBeenCalledWith(
      'myworkspace', 'flagrepo', 'feat: new', 'feature/new-feature', 'main', undefined
    )
  })
})
