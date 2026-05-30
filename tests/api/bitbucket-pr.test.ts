import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios')
vi.mock('../../src/auth/index.js', () => ({
  getCredentials: vi.fn().mockReturnValue({ email: 'user@example.com', apiToken: 'token' }),
  buildBasicAuth: vi.fn().mockReturnValue('Basic dXNlckBleGFtcGxlLmNvbTp0b2tlbg=='),
}))

const mockGet = vi.fn()
const mockPost = vi.fn()

const {
  listPullRequests,
  getPullRequest,
  getPullRequestDiffStat,
  getPullRequestDiff,
  approvePullRequest,
  declinePullRequest,
  postComment,
} = await import('../../src/api/bitbucket.js')

const WS = 'myworkspace'
const REPO = 'myrepo'

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(axios.create).mockReturnValue({ get: mockGet, post: mockPost } as any)
})

function makeAxiosError(status: number | null, code?: string) {
  const err = new Error('axios error') as any
  err.isAxiosError = true
  if (status !== null) err.response = { status }
  if (code) err.code = code
  vi.mocked(axios.isAxiosError).mockReturnValueOnce(true).mockReturnValueOnce(true)
  return err
}

const BITBUCKET_PR = {
  id: 42,
  title: 'feat: update',
  author: { display_name: 'hung' },
  state: 'OPEN',
  updated_on: '2024-01-01T00:00:00.000Z',
  description: 'desc',
  reviewers: [{ display_name: 'minh' }],
  source: { branch: { name: 'feature/foo' } },
  destination: { branch: { name: 'main' } },
}

describe('listPullRequests', () => {
  it('returns mapped PullRequest array', async () => {
    mockGet.mockResolvedValue({ data: { values: [BITBUCKET_PR] } })
    const result = await listPullRequests(WS, REPO, 'open', 20)
    expect(result).toEqual([{
      id: 42,
      title: 'feat: update',
      authorName: 'hung',
      state: 'OPEN',
      updatedOn: '2024-01-01T00:00:00.000Z',
      description: 'desc',
      reviewerNames: ['minh'],
      sourceBranch: 'feature/foo',
      destBranch: 'main',
    }])
  })

  it('passes uppercase state param to API', async () => {
    mockGet.mockResolvedValue({ data: { values: [] } })
    await listPullRequests(WS, REPO, 'open', 20)
    expect(mockGet).toHaveBeenCalledWith(
      '/repositories/myworkspace/myrepo/pullrequests',
      { params: { state: 'OPEN', pagelen: 20 } }
    )
  })

  it('omits state param for "all"', async () => {
    mockGet.mockResolvedValue({ data: { values: [] } })
    await listPullRequests(WS, REPO, 'all', 20)
    expect(mockGet).toHaveBeenCalledWith(
      '/repositories/myworkspace/myrepo/pullrequests',
      { params: { pagelen: 20 } }
    )
  })

  it('handles missing reviewers field (list endpoint omits it)', async () => {
    const prWithoutReviewers = { ...BITBUCKET_PR, reviewers: undefined }
    mockGet.mockResolvedValue({ data: { values: [prWithoutReviewers] } })
    const result = await listPullRequests(WS, REPO, 'open', 20)
    expect(result[0].reviewerNames).toEqual([])
  })

  it('throws on 403', async () => {
    mockGet.mockRejectedValue(makeAxiosError(403))
    await expect(listPullRequests(WS, REPO, 'open', 20)).rejects.toThrow('403 Forbidden')
  })
})

describe('getPullRequest', () => {
  it('returns mapped PullRequest', async () => {
    mockGet.mockResolvedValue({ data: BITBUCKET_PR })
    const result = await getPullRequest(WS, REPO, 42)
    expect(result.id).toBe(42)
    expect(result.authorName).toBe('hung')
    expect(mockGet).toHaveBeenCalledWith('/repositories/myworkspace/myrepo/pullrequests/42')
  })

  it('throws "PR #42 not found." on 404', async () => {
    mockGet.mockRejectedValue(makeAxiosError(404))
    await expect(getPullRequest(WS, REPO, 42)).rejects.toThrow('PR #42 not found.')
  })

  it('retries once on timeout then succeeds', async () => {
    const timeoutError = makeAxiosError(null, 'ECONNABORTED')
    mockGet.mockRejectedValueOnce(timeoutError).mockResolvedValueOnce({ data: BITBUCKET_PR })
    const result = await getPullRequest(WS, REPO, 42)
    expect(result.id).toBe(42)
    expect(mockGet).toHaveBeenCalledTimes(2)
  })
})

describe('getPullRequestDiffStat', () => {
  it('returns summed additions, deletions, filesChanged', async () => {
    mockGet.mockResolvedValue({
      data: {
        values: [
          { lines_added: 10, lines_removed: 3 },
          { lines_added: 5, lines_removed: 1 },
        ],
      },
    })
    const result = await getPullRequestDiffStat(WS, REPO, 42)
    expect(result).toEqual({ additions: 15, deletions: 4, filesChanged: 2 })
    expect(mockGet).toHaveBeenCalledWith(
      '/repositories/myworkspace/myrepo/pullrequests/42/diffstat',
      { params: { pagelen: 2000 } }
    )
  })
})

describe('getPullRequestDiff', () => {
  it('returns diff as string with responseType text', async () => {
    mockGet.mockResolvedValue({ data: 'diff --git a/foo b/foo\n+added\n' })
    const result = await getPullRequestDiff(WS, REPO, 42)
    expect(result).toBe('diff --git a/foo b/foo\n+added\n')
    expect(mockGet).toHaveBeenCalledWith(
      '/repositories/myworkspace/myrepo/pullrequests/42/diff',
      { responseType: 'text' }
    )
  })
})

describe('approvePullRequest', () => {
  it('calls POST approve endpoint', async () => {
    mockPost.mockResolvedValue({ data: {} })
    await approvePullRequest(WS, REPO, 42)
    expect(mockPost).toHaveBeenCalledWith('/repositories/myworkspace/myrepo/pullrequests/42/approve')
  })
})

describe('declinePullRequest', () => {
  it('calls POST decline endpoint', async () => {
    mockPost.mockResolvedValue({ data: {} })
    await declinePullRequest(WS, REPO, 42)
    expect(mockPost).toHaveBeenCalledWith('/repositories/myworkspace/myrepo/pullrequests/42/decline')
  })
})

describe('postComment', () => {
  it('posts a general comment', async () => {
    mockPost.mockResolvedValue({ data: {} })
    await postComment(WS, REPO, 42, 'looks good')
    expect(mockPost).toHaveBeenCalledWith(
      '/repositories/myworkspace/myrepo/pullrequests/42/comments',
      { content: { raw: 'looks good' } }
    )
  })

  it('posts an inline comment using "to" for line number', async () => {
    mockPost.mockResolvedValue({ data: {} })
    await postComment(WS, REPO, 42, 'nit', { path: 'src/foo.ts', line: 15 })
    expect(mockPost).toHaveBeenCalledWith(
      '/repositories/myworkspace/myrepo/pullrequests/42/comments',
      { content: { raw: 'nit' }, inline: { path: 'src/foo.ts', to: 15 } }
    )
  })

  it('throws "403 Forbidden" on 403', async () => {
    mockPost.mockRejectedValue(makeAxiosError(403))
    await expect(postComment(WS, REPO, 42, 'hi')).rejects.toThrow('403 Forbidden')
  })
})
