import { describe, it, expect } from 'vitest'
// @ts-expect-error plain ESM script without type declarations
import * as vc from '../../scripts/version-check.mjs'

describe('suggestBump', () => {
  it.each([
    ['feat(pr): add reviewers', 'minor'],
    ['fix: handle 403', 'patch'],
    ['refactor: split modules', 'patch'],
    ['docs: update README', 'skip'],
    ['ci: add release workflow', 'skip'],
    ['feat!: drop node 20', 'major'],
  ])('%s -> %s', (title, bump) => {
    expect(vc.suggestBump({ title }).bump).toBe(bump)
  })

  it('treats a BREAKING CHANGE footer as major', () => {
    expect(vc.suggestBump({ title: 'fix: x', body: 'BREAKING CHANGE: removed flag' }).bump).toBe('major')
  })

  it('ignores BREAKING CHANGE: in the middle of a sentence', () => {
    const body = 'This is not a BREAKING CHANGE: old flags still work.'
    expect(vc.suggestBump({ title: 'feat: x', body }).bump).toBe('minor')
  })

  it('skips on a skip-release label', () => {
    expect(vc.suggestBump({ title: 'feat: x', labels: '["skip-release"]' }).bump).toBe('skip')
  })

  it('rejects a title that is not Conventional Commits', () => {
    expect(() => vc.suggestBump({ title: 'Add reviewers' })).toThrow('Conventional Commits')
  })
})

describe('checkVersion', () => {
  const minor = { bump: 'minor', reason: "type 'feat'" }
  const skip = { bump: 'skip', reason: "type 'docs'" }

  it('passes a matching bump and marks it for release', () => {
    expect(vc.checkVersion('1.2.0', '1.3.0', minor)).toMatchObject({ ok: true, release: true })
  })

  it('fails when a releasing PR keeps the version', () => {
    const result = vc.checkVersion('1.2.0', '1.2.0', minor)
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('not bumped')
  })

  it('passes an unchanged version for a non-releasing PR', () => {
    expect(vc.checkVersion('1.2.0', '1.2.0', skip)).toMatchObject({ ok: true, release: false })
  })

  it('fails a version that skips ahead or goes back', () => {
    expect(vc.checkVersion('1.2.0', '1.4.0', minor).ok).toBe(false)
    expect(vc.checkVersion('1.2.0', '1.1.9', minor).ok).toBe(false)
  })

  it('fails a non-major bump for a breaking change', () => {
    expect(vc.checkVersion('1.2.0', '1.3.0', { bump: 'major', reason: 'x' }).ok).toBe(false)
  })

  it('only warns when the bump differs from the suggestion', () => {
    const result = vc.checkVersion('1.2.0', '1.2.1', minor)
    expect(result.ok).toBe(true)
    expect(result.warnings).toHaveLength(1)
  })
})

describe('resolveBase', () => {
  it('reads tags with or without a v prefix', () => {
    expect(vc.latestTagVersion(['1.0.2', 'v1.1.0', 'foo', '1.0.10'])).toBe('1.1.0')
  })

  it('uses the base branch version when it is ahead of the tags', () => {
    expect(vc.resolveBase('1.1.0', '1.2.0')).toBe('1.2.0')
    expect(vc.resolveBase('1.3.0', '1.2.0')).toBe('1.3.0')
    expect(vc.resolveBase(null, '1.0.0')).toBe('1.0.0')
  })
})
