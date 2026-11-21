import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios')
vi.mock('../../src/auth/index.js', () => ({
  getCredentials: vi.fn().mockReturnValue({ email: 'user@example.com', apiToken: 'token' }),
  buildBasicAuth: vi.fn().mockReturnValue('Basic dXNlckBleGFtcGxlLmNvbTp0b2tlbg=='),
}))

const mockGet = vi.fn()

const { getDefaultReviewers } = await import('../../src/api/reviewers.js')
const { getCurrentUser } = await import('../../src/api/users.js')

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(axios.create).mockReturnValue({ get: mockGet } as any)
})

const user = (n: string) => ({ uuid: `{${n}}`, account_id: `${n}-id`, display_name: n.toUpperCase() })

describe('getDefaultReviewers', () => {
  it('requests effective default reviewers and maps users', async () => {
    mockGet.mockResolvedValue({ data: { values: [{ user: user('a'), reviewer_type: 'repository' }] } })
    const result = await getDefaultReviewers('ws', 'repo')
    expect(mockGet).toHaveBeenCalledWith('/repositories/ws/repo/effective-default-reviewers', {
      params: { pagelen: 100 },
    })
    expect(result).toEqual([{ uuid: '{a}', account_id: 'a-id', displayName: 'A' }])
  })

  it('follows next links across pages', async () => {
    mockGet
      .mockResolvedValueOnce({ data: { values: [{ user: user('a') }], next: 'https://api.bitbucket.org/2.0/page2' } })
      .mockResolvedValueOnce({ data: { values: [{ user: user('b') }] } })
    const result = await getDefaultReviewers('ws', 'repo')
    expect(mockGet).toHaveBeenLastCalledWith('https://api.bitbucket.org/2.0/page2')
    expect(result.map((r) => r.uuid)).toEqual(['{a}', '{b}'])
  })

  it('returns an empty list when the repo has no default reviewers', async () => {
    mockGet.mockResolvedValue({ data: { values: [] } })
    expect(await getDefaultReviewers('ws', 'repo')).toEqual([])
  })

  it('stops after the page limit to avoid an endless loop', async () => {
    mockGet.mockResolvedValue({ data: { values: [{ user: user('a') }], next: 'https://api.bitbucket.org/2.0/again' } })
    await expect(getDefaultReviewers('ws', 'repo')).rejects.toThrow('Too many pages of default reviewers.')
  })
})

describe('getCurrentUser', () => {
  it('maps the /user response', async () => {
    mockGet.mockResolvedValue({ data: user('me') })
    expect(await getCurrentUser()).toEqual({ uuid: '{me}', account_id: 'me-id', displayName: 'ME' })
    expect(mockGet).toHaveBeenCalledWith('/user')
  })
})
