import { describe, it, expect } from 'vitest'

const { parseReviewerId, mergeReviewers, sameReviewer } = await import('../../src/pr/reviewers.js')

const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'
const ACCOUNT_ID = '557058:3f2504e0-4f89-11d3-9a0c-0305e82c3301'

describe('parseReviewerId', () => {
  it('parses a braced uuid', () => {
    expect(parseReviewerId(`{${UUID}}`)).toEqual({ uuid: `{${UUID}}` })
  })

  it('wraps a bare uuid in braces', () => {
    expect(parseReviewerId(UUID)).toEqual({ uuid: `{${UUID}}` })
  })

  it('parses a prefixed account_id', () => {
    expect(parseReviewerId(ACCOUNT_ID)).toEqual({ account_id: ACCOUNT_ID })
  })

  it('parses a 24-character hex account_id', () => {
    expect(parseReviewerId('5b10a2844c20165700ede21f')).toEqual({
      account_id: '5b10a2844c20165700ede21f',
    })
  })

  it('lowercases an uppercase uuid', () => {
    expect(parseReviewerId(`{${UUID.toUpperCase()}}`)).toEqual({ uuid: `{${UUID}}` })
    expect(parseReviewerId(UUID.toUpperCase())).toEqual({ uuid: `{${UUID}}` })
  })

  it('trims surrounding whitespace', () => {
    expect(parseReviewerId(`  ${UUID}  `)).toEqual({ uuid: `{${UUID}}` })
  })

  it('throws on an empty value', () => {
    expect(() => parseReviewerId('   ')).toThrow('Reviewer ID cannot be empty.')
  })

  it('throws on a display name', () => {
    expect(() => parseReviewerId('Nguyen Ba Hung')).toThrow(
      'Invalid reviewer ID "Nguyen Ba Hung". Use a uuid or an account_id.'
    )
  })
})

describe('sameReviewer', () => {
  it('matches by uuid', () => {
    expect(sameReviewer({ uuid: '{a}' }, { uuid: '{a}', account_id: 'x' })).toBe(true)
  })

  it('matches by account_id', () => {
    expect(sameReviewer({ account_id: 'x' }, { uuid: '{a}', account_id: 'x' })).toBe(true)
  })

  it('does not match a uuid-only ref against an account_id-only ref', () => {
    expect(sameReviewer({ uuid: '{a}' }, { account_id: 'x' })).toBe(false)
  })
})

describe('mergeReviewers', () => {
  const author = { uuid: '{author}', account_id: 'author-id' }

  it('appends requested reviewers to current ones', () => {
    expect(mergeReviewers([{ uuid: '{a}' }], [{ uuid: '{b}' }], author)).toEqual([
      { uuid: '{a}' },
      { uuid: '{b}' },
    ])
  })

  it('drops duplicates and keeps the richer ref', () => {
    const merged = mergeReviewers(
      [{ uuid: '{a}' }],
      [{ uuid: '{a}', account_id: 'a-id', displayName: 'A' }, { account_id: 'a-id' }],
      author
    )
    expect(merged).toEqual([{ uuid: '{a}', account_id: 'a-id', displayName: 'A' }])
  })

  it('removes the author', () => {
    expect(
      mergeReviewers([], [{ account_id: 'author-id' }, { uuid: '{author}' }, { uuid: '{b}' }], author)
    ).toEqual([{ uuid: '{b}' }])
  })

  it('returns an empty list when nothing is given', () => {
    expect(mergeReviewers([], [], author)).toEqual([])
  })
})
