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
vi.mock('../../src/pr/index.js', () => ({
  getRepoContext: mockGetRepoContext,
  formatPrList: mockFormatPrList,
  formatPrView: mockFormatPrView,
  formatDiff: mockFormatDiff,
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
})

describe('pr decline', () => {
  it('shows confirm prompt then calls decline', async () => {
    mockGetPullRequest.mockResolvedValue(MOCK_PR)
    mockConfirm.mockResolvedValue(true)
    mockDeclinePullRequest.mockResolvedValue(undefined)
    await runCommand(['pr', 'decline', '42'])
    expect(mockDeclinePullRequest).toHaveBeenCalledWith('myworkspace', 'myrepo', 42)
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
})
