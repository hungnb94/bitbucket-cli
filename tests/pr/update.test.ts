import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PullRequest } from '../../src/pr/types.js'

const mockGetUserByUsername = vi.fn()
vi.mock('../../src/api/users.js', () => ({
  getUserByUsername: mockGetUserByUsername,
}))

const { resolveReviewerUsernames, buildReviewerPatch, diffFields } =
  await import('../../src/pr/update.js')

const BASE_PR: PullRequest = {
  id: 42,
  title: 'feat: update',
  authorName: 'hung',
  state: 'OPEN',
  updatedOn: '2024-01-01T00:00:00.000Z',
  description: 'desc',
  reviewerNames: ['minh'],
  reviewerUuids: ['{uuid-minh}'],
  closeSourceBranch: false,
  sourceBranch: 'feature/foo',
  destBranch: 'main',
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('resolveReviewerUsernames', () => {
  it('returns uuid objects for all resolved usernames', async () => {
    mockGetUserByUsername
      .mockResolvedValueOnce({ uuid: '{uuid-alice}', displayName: 'Alice' })
      .mockResolvedValueOnce({ uuid: '{uuid-bob}', displayName: 'Bob' })
    const result = await resolveReviewerUsernames(['alice', 'bob'])
    expect(result).toEqual([{ uuid: '{uuid-alice}' }, { uuid: '{uuid-bob}' }])
  })

  it('throws aggregated error listing all unknown usernames', async () => {
    mockGetUserByUsername
      .mockRejectedValueOnce(new Error('Reviewer not found: ghost'))
      .mockRejectedValueOnce(new Error('Reviewer not found: nobody'))
    await expect(resolveReviewerUsernames(['ghost', 'nobody'])).rejects.toThrow('ghost')
  })

  it('returns empty array for empty input', async () => {
    const result = await resolveReviewerUsernames([])
    expect(result).toEqual([])
    expect(mockGetUserByUsername).not.toHaveBeenCalled()
  })
})

describe('buildReviewerPatch', () => {
  it('adds a new reviewer to the list', async () => {
    mockGetUserByUsername.mockResolvedValueOnce({ uuid: '{uuid-alice}', displayName: 'Alice' })
    const result = await buildReviewerPatch(['{uuid-minh}'], ['alice'], [])
    expect(result).toEqual([{ uuid: '{uuid-minh}' }, { uuid: '{uuid-alice}' }])
  })

  it('removes an existing reviewer from the list', async () => {
    mockGetUserByUsername.mockResolvedValueOnce({ uuid: '{uuid-minh}', displayName: 'Minh' })
    const result = await buildReviewerPatch(['{uuid-minh}'], [], ['minh'])
    expect(result).toEqual([])
  })

  it('returns undefined when resulting set equals current (no change)', async () => {
    mockGetUserByUsername.mockResolvedValueOnce({ uuid: '{uuid-minh}', displayName: 'Minh' })
    const result = await buildReviewerPatch(['{uuid-minh}'], ['minh'], [])
    expect(result).toBeUndefined()
  })

  it('throws when same username appears in both add and remove', async () => {
    await expect(
      buildReviewerPatch(['{uuid-minh}'], ['alice'], ['alice'])
    ).rejects.toThrow('alice appears in both --add-reviewer and --remove-reviewer')
  })

  it('throws aggregated error when a username cannot be resolved', async () => {
    mockGetUserByUsername.mockRejectedValueOnce(new Error('Reviewer not found: ghost'))
    await expect(
      buildReviewerPatch(['{uuid-minh}'], ['ghost'], [])
    ).rejects.toThrow('Reviewer not found: ghost')
  })
})

describe('diffFields', () => {
  it('returns empty patch when nothing changed', () => {
    const result = diffFields(BASE_PR, { title: 'feat: update', description: 'desc', target: 'main' })
    expect(result).toEqual({})
  })

  it('includes title when changed', () => {
    expect(diffFields(BASE_PR, { title: 'new title' })).toEqual({ title: 'new title' })
  })

  it('includes description when changed', () => {
    expect(diffFields(BASE_PR, { description: 'new desc' })).toEqual({ description: 'new desc' })
  })

  it('includes description when cleared to empty string', () => {
    expect(diffFields(BASE_PR, { description: '' })).toEqual({ description: '' })
  })

  it('includes destination when target changed', () => {
    expect(diffFields(BASE_PR, { target: 'develop' })).toEqual({
      destination: { branch: { name: 'develop' } },
    })
  })

  it('includes reviewers when newReviewers provided', () => {
    const newReviewers = [{ uuid: '{uuid-alice}' }]
    expect(diffFields(BASE_PR, {}, newReviewers)).toEqual({ reviewers: newReviewers })
  })

  it('includes close_source_branch when changed', () => {
    expect(diffFields(BASE_PR, { closeSourceBranch: true })).toEqual({
      close_source_branch: true,
    })
  })

  it('omits fields that are undefined in input', () => {
    const result = diffFields(BASE_PR, {})
    expect(result).toEqual({})
  })
})
