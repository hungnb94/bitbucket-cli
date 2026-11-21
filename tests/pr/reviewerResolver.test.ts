import { describe, it, expect, vi } from 'vitest'
import type { ReviewerPort } from '../../src/pr/reviewerResolver.js'

const { ReviewerResolver } = await import('../../src/pr/reviewerResolver.js')

const UUID_B = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'
const ACCOUNT_A = '5b10a2844c20165700ede21f'
const ME = { uuid: '{me}', account_id: 'me-id', displayName: 'Me' }
const AUTHOR = { uuid: '{author}', account_id: 'author-id' }

function makePort(defaults = [
  { uuid: '{a}', account_id: 'a-id', displayName: 'A' },
  { uuid: '{me}', account_id: 'me-id', displayName: 'Me' },
]): ReviewerPort {
  return {
    getDefaultReviewers: vi.fn().mockResolvedValue(defaults),
    getCurrentUser: vi.fn().mockResolvedValue(ME),
  }
}

describe('ReviewerResolver', () => {
  it('returns explicit reviewers only when defaults are not requested', async () => {
    const port = makePort()
    const resolver = new ReviewerResolver(port)
    const result = await resolver.resolve('ws', 'repo', { explicit: [UUID_B], useDefaults: false })
    expect(result).toEqual([{ uuid: `{${UUID_B}}` }])
    expect(port.getDefaultReviewers).not.toHaveBeenCalled()
  })

  it('returns default reviewers without the current user', async () => {
    const port = makePort()
    const result = await new ReviewerResolver(port).resolve('ws', 'repo', {
      explicit: [],
      useDefaults: true,
    })
    expect(port.getDefaultReviewers).toHaveBeenCalledWith('ws', 'repo')
    expect(result).toEqual([{ uuid: '{a}', account_id: 'a-id', displayName: 'A' }])
  })

  it('combines defaults and explicit reviewers without duplicates', async () => {
    const port = makePort([{ uuid: '{a}', account_id: ACCOUNT_A, displayName: 'A' }])
    const result = await new ReviewerResolver(port).resolve('ws', 'repo', {
      explicit: [ACCOUNT_A, UUID_B],
      useDefaults: true,
    })
    expect(result).toEqual([
      { uuid: '{a}', account_id: ACCOUNT_A, displayName: 'A' },
      { uuid: `{${UUID_B}}` },
    ])
  })

  it('keeps current reviewers and excludes the given author instead of the current user', async () => {
    const port = makePort([
      { uuid: '{author}', account_id: 'author-id', displayName: 'Author' },
      { uuid: '{me}', account_id: 'me-id', displayName: 'Me' },
    ])
    const result = await new ReviewerResolver(port).resolve('ws', 'repo', {
      explicit: [],
      useDefaults: true,
      current: [{ uuid: '{old}' }],
      author: AUTHOR,
    })
    expect(port.getCurrentUser).not.toHaveBeenCalled()
    expect(result).toEqual([{ uuid: '{old}' }, { uuid: '{me}', account_id: 'me-id', displayName: 'Me' }])
  })

  it('rejects an invalid explicit reviewer before calling the API', async () => {
    const port = makePort()
    await expect(
      new ReviewerResolver(port).resolve('ws', 'repo', { explicit: ['bad name'], useDefaults: true })
    ).rejects.toThrow('Invalid reviewer ID "bad name"')
    expect(port.getDefaultReviewers).not.toHaveBeenCalled()
  })

  it('propagates API errors', async () => {
    const port = makePort()
    vi.mocked(port.getDefaultReviewers).mockRejectedValue(new Error('403 Forbidden'))
    await expect(
      new ReviewerResolver(port).resolve('ws', 'repo', { explicit: [], useDefaults: true })
    ).rejects.toThrow('403 Forbidden')
  })

  it('keeps explicit reviewers when the token cannot read the current user', async () => {
    const port = makePort()
    port.getCurrentUser = vi.fn().mockRejectedValue(new Error('403 Forbidden: token missing required scopes.'))
    const result = await new ReviewerResolver(port).resolve('ws', 'repo', {
      explicit: [UUID_B],
      useDefaults: false,
    })
    expect(result).toEqual([{ uuid: `{${UUID_B}}` }])
  })

  it('still fails on 403 when default reviewers are requested', async () => {
    const port = makePort()
    port.getCurrentUser = vi.fn().mockRejectedValue(new Error('403 Forbidden: token missing required scopes.'))
    await expect(
      new ReviewerResolver(port).resolve('ws', 'repo', { explicit: [], useDefaults: true })
    ).rejects.toThrow('403')
  })

  it('rethrows non-403 errors from the current user lookup', async () => {
    const port = makePort()
    port.getCurrentUser = vi.fn().mockRejectedValue(new Error('Connection failed after retry.'))
    await expect(
      new ReviewerResolver(port).resolve('ws', 'repo', { explicit: [UUID_B], useDefaults: false })
    ).rejects.toThrow('Connection failed')
  })
})
