import { describe, it, expect } from 'vitest'
import type { PullRequest } from '../../src/pr/types.js'

const { diffFields } =
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

describe('diffFields', () => {
  it('returns empty patch when nothing changed', () => {
    const result = diffFields(BASE_PR, { title: 'feat: update', description: 'desc' })
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

  it('omits fields that are undefined in input', () => {
    const result = diffFields(BASE_PR, {})
    expect(result).toEqual({})
  })
})
