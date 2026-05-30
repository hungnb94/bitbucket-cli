import chalk from 'chalk'
import type { PullRequest, DiffStat } from './types.js'

const STATE_WIDTH = 10

function colorState(state: string): string {
  const padded = state.padEnd(STATE_WIDTH)
  switch (state) {
    case 'OPEN': return chalk.green(padded)
    case 'MERGED': return chalk.blue(padded)
    case 'DECLINED': return chalk.red(padded)
    default: return padded
  }
}

function timeAgo(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function formatPrList(prs: PullRequest[]): string {
  if (prs.length === 0) return '  No pull requests found.'

  const idWidth = Math.max(4, ...prs.map((pr) => String(pr.id).length))
  const titleWidth = Math.min(40, Math.max(5, ...prs.map((pr) => pr.title.length)))
  const authorWidth = Math.max(6, ...prs.map((pr) => pr.authorName.length))

  const header = [
    '  ' + 'ID'.padEnd(idWidth),
    'Title'.padEnd(titleWidth),
    'Author'.padEnd(authorWidth),
    'Status'.padEnd(STATE_WIDTH),
    'Updated',
  ].join('  ')

  const separator =
    '  ' +
    [
      '─'.repeat(idWidth),
      '─'.repeat(titleWidth),
      '─'.repeat(authorWidth),
      '─'.repeat(STATE_WIDTH),
      '─'.repeat(10),
    ].join('  ')

  const rows = prs.map((pr) => {
    const title =
      pr.title.length > titleWidth
        ? pr.title.slice(0, titleWidth - 1) + '…'
        : pr.title.padEnd(titleWidth)
    return [
      '  ' + String(pr.id).padEnd(idWidth),
      title,
      pr.authorName.padEnd(authorWidth),
      colorState(pr.state),
      timeAgo(pr.updatedOn),
    ].join('  ')
  })

  return [header, separator, ...rows].join('\n')
}

export function formatPrView(pr: PullRequest, diffStat: DiffStat): string {
  const lines: string[] = [
    '',
    `  #${pr.id}  ${pr.title}`,
    '  ' + '─'.repeat(Math.min(60, pr.title.length + 8)),
    `  Author:     ${pr.authorName}`,
    `  Reviewers:  ${pr.reviewerNames.length > 0 ? pr.reviewerNames.join(', ') : '(none)'}`,
    `  Status:     ${colorState(pr.state)}`,
    `  Branch:     ${pr.sourceBranch} → ${pr.destBranch}`,
    `  Changes:    +${diffStat.additions} -${diffStat.deletions}  ·  ${diffStat.filesChanged} file${diffStat.filesChanged !== 1 ? 's' : ''}`,
    '',
  ]

  if (pr.description.trim()) {
    lines.push('  Description:')
    pr.description.split('\n').forEach((line) => lines.push('  ' + line))
    lines.push('')
  }

  return lines.join('\n')
}

export function formatDiff(diff: string): string {
  return diff
    .split('\n')
    .map((line) => {
      if (line.startsWith('+++') || line.startsWith('---')) return line
      if (line.startsWith('+')) return chalk.green(line)
      if (line.startsWith('-')) return chalk.red(line)
      if (line.startsWith('@@')) return chalk.cyan(line)
      return line
    })
    .join('\n')
}
