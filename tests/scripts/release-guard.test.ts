import { describe, it, expect } from 'vitest'
// @ts-expect-error plain ESM script without type declarations
import * as guard from '../../scripts/release-guard.mjs'

const commit = (subject: string, labels: string[] = []) => ({ sha: 'abcdef1234567', subject, labels })

describe('unreleasedChanges', () => {
  it('lists commits whose type needs a release', () => {
    const changes = guard.unreleasedChanges([
      commit('feat(pr): add reviewers (#18)'),
      commit('docs: update README (#19)'),
      commit('fix: handle 403 (#20)'),
    ])
    expect(changes.map((c: { subject: string }) => c.subject)).toEqual([
      'feat(pr): add reviewers (#18)',
      'fix: handle 403 (#20)',
    ])
  })

  it('returns nothing for non-releasing types or no commits', () => {
    expect(guard.unreleasedChanges([commit('ci: add workflow'), commit('chore: tidy')])).toEqual([])
    expect(guard.unreleasedChanges([])).toEqual([])
  })

  it('skips a commit whose PR has the skip-release label', () => {
    expect(guard.unreleasedChanges([commit('feat: x', ['skip-release'])])).toEqual([])
  })

  it('ignores subjects that are not Conventional Commits instead of throwing', () => {
    expect(guard.unreleasedChanges([commit('Merge pull request #5 from x/y')])).toEqual([])
  })
})

describe('formatFailure', () => {
  it('suggests the largest bump needed', () => {
    const changes = guard.unreleasedChanges([commit('fix: a'), commit('feat: b')])
    const message = guard.formatFailure('1.3.0', changes)
    expect(message).toContain('abcdef1 feat: b')
    expect(message).toContain('1.4.0 (minor)')
  })

  it('suggests major for a breaking change', () => {
    const changes = guard.unreleasedChanges([commit('feat!: drop flag')])
    expect(guard.formatFailure('1.3.0', changes)).toContain('2.0.0 (major)')
  })
})
