import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('child_process', () => ({ execSync: vi.fn() }))

import { execSync } from 'child_process'
const { getRepoContext, getCurrentBranch, detectDefaultTarget } = await import('../../src/pr/remote.js')

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

describe('getCurrentBranch', () => {
  it('returns trimmed branch name', () => {
    vi.mocked(execSync).mockReturnValue('feature/my-branch\n' as any)
    expect(getCurrentBranch()).toBe('feature/my-branch')
  })

  it('throws when in detached HEAD state (empty output)', () => {
    vi.mocked(execSync).mockReturnValue('\n' as any)
    expect(() => getCurrentBranch()).toThrow('Could not detect current branch. Are you in a git repo?')
  })

  it('throws when git command fails', () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('fatal') })
    expect(() => getCurrentBranch()).toThrow('Could not detect current branch. Are you in a git repo?')
  })
})

describe('detectDefaultTarget', () => {
  it('returns "main" when main branch exists locally', () => {
    vi.mocked(execSync).mockReturnValueOnce('  main\n' as any)
    expect(detectDefaultTarget()).toBe('main')
  })

  it('returns "master" when main does not exist but master does', () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('' as any)
      .mockReturnValueOnce('  master\n' as any)
    expect(detectDefaultTarget()).toBe('master')
  })

  it('throws when neither main nor master exists', () => {
    vi.mocked(execSync)
      .mockReturnValueOnce('' as any)
      .mockReturnValueOnce('' as any)
    expect(() => detectDefaultTarget()).toThrow(
      'Could not detect default target branch. Use --target <branch>.'
    )
  })

  it('throws when git command fails', () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('fatal') })
    expect(() => detectDefaultTarget()).toThrow(
      'Could not detect default target branch. Use --target <branch>.'
    )
  })
})
