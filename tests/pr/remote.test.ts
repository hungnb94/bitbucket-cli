import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('child_process', () => ({ execSync: vi.fn() }))

import { execSync } from 'child_process'
const { getRepoContext } = await import('../../src/pr/remote.js')

beforeEach(() => vi.clearAllMocks())

describe('getRepoContext', () => {
  it('parses HTTPS URL without .git suffix', () => {
    vi.mocked(execSync).mockReturnValue('https://bitbucket.org/myworkspace/myrepo\n' as any)
    expect(getRepoContext()).toEqual({ workspace: 'myworkspace', repo: 'myrepo' })
  })

  it('parses HTTPS URL with .git suffix', () => {
    vi.mocked(execSync).mockReturnValue('https://bitbucket.org/myworkspace/myrepo.git\n' as any)
    expect(getRepoContext()).toEqual({ workspace: 'myworkspace', repo: 'myrepo' })
  })

  it('parses SSH URL', () => {
    vi.mocked(execSync).mockReturnValue('git@bitbucket.org:myworkspace/myrepo.git\n' as any)
    expect(getRepoContext()).toEqual({ workspace: 'myworkspace', repo: 'myrepo' })
  })

  it('parses SSH URL with custom host alias (e.g. work.bitbucket.org)', () => {
    vi.mocked(execSync).mockReturnValue('git@work.bitbucket.org:myworkspace/myrepo.git\n' as any)
    expect(getRepoContext()).toEqual({ workspace: 'myworkspace', repo: 'myrepo' })
  })

  it('throws when not a git repo or no remote', () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('fatal') })
    expect(() => getRepoContext()).toThrow('Could not detect workspace/repo from git remote origin.')
  })

  it('throws when remote is not a Bitbucket URL', () => {
    vi.mocked(execSync).mockReturnValue('https://github.com/user/repo.git\n' as any)
    expect(() => getRepoContext()).toThrow('Remote origin is not a Bitbucket repository.')
  })
})
