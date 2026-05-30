import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import chalk from 'chalk'

// Force colors on so we can assert ANSI output
chalk.level = 3

const { formatPrList, formatPrView, formatDiff } = await import('../../src/pr/format.js')

import type { PullRequest, DiffStat } from '../../src/pr/types.js'

const MOCK_PR: PullRequest = {
  id: 42,
  title: 'feat: android update',
  authorName: 'hung',
  state: 'OPEN',
  updatedOn: '2024-01-01T10:00:00.000Z',
  description: 'Adds update flow.',
  reviewerNames: ['minh', 'an'],
  sourceBranch: 'feature/foo',
  destBranch: 'main',
}

const MOCK_DIFFSTAT: DiffStat = { additions: 120, deletions: 34, filesChanged: 5 }

describe('formatPrList', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'))
  })

  afterAll(() => vi.useRealTimers())

  it('contains PR id, title, author, and state', () => {
    const output = formatPrList([MOCK_PR])
    expect(output).toContain('42')
    expect(output).toContain('feat: android update')
    expect(output).toContain('hung')
    expect(output).toContain('OPEN')
  })

  it('shows relative time for updatedOn', () => {
    const output = formatPrList([MOCK_PR])
    expect(output).toContain('2h ago')
  })

  it('returns "No pull requests found." for empty array', () => {
    expect(formatPrList([])).toContain('No pull requests found.')
  })

  it('colors OPEN state green', () => {
    const output = formatPrList([MOCK_PR])
    expect(output).toContain(chalk.green('OPEN'.padEnd(10)))
  })

  it('colors DECLINED state red', () => {
    const pr = { ...MOCK_PR, state: 'DECLINED' as const }
    const output = formatPrList([pr])
    expect(output).toContain(chalk.red('DECLINED'.padEnd(10)))
  })

  it('colors MERGED state blue', () => {
    const pr = { ...MOCK_PR, state: 'MERGED' as const }
    const output = formatPrList([pr])
    expect(output).toContain(chalk.blue('MERGED'.padEnd(10)))
  })
})

describe('formatPrView', () => {
  it('contains id, title, author, reviewers, status, branch, changes, description', () => {
    const output = formatPrView(MOCK_PR, MOCK_DIFFSTAT)
    expect(output).toContain('#42')
    expect(output).toContain('feat: android update')
    expect(output).toContain('hung')
    expect(output).toContain('minh, an')
    expect(output).toContain('feature/foo → main')
    expect(output).toContain('+120')
    expect(output).toContain('-34')
    expect(output).toContain('5 files')
    expect(output).toContain('Adds update flow.')
  })

  it('shows "(none)" when no reviewers', () => {
    const pr = { ...MOCK_PR, reviewerNames: [] }
    expect(formatPrView(pr, MOCK_DIFFSTAT)).toContain('(none)')
  })
})

describe('formatDiff', () => {
  it('colors added lines green', () => {
    const output = formatDiff('+added line\n')
    expect(output).toContain(chalk.green('+added line'))
  })

  it('colors removed lines red', () => {
    const output = formatDiff('-removed line\n')
    expect(output).toContain(chalk.red('-removed line'))
  })

  it('colors hunk headers cyan', () => {
    const output = formatDiff('@@ -1,1 +1,1 @@\n')
    expect(output).toContain(chalk.cyan('@@ -1,1 +1,1 @@'))
  })

  it('does not color +++ or --- header lines', () => {
    const output = formatDiff('+++ b/foo.ts\n--- a/foo.ts\n')
    expect(output).toContain('+++ b/foo.ts')
    expect(output).toContain('--- a/foo.ts')
    expect(output).not.toContain(chalk.green('+++ b/foo.ts'))
    expect(output).not.toContain(chalk.red('--- a/foo.ts'))
  })

  it('leaves context lines unchanged', () => {
    const output = formatDiff(' context line\n')
    expect(output).toContain(' context line')
  })
})
