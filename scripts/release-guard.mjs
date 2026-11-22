#!/usr/bin/env node
// Fails when releasing changes reached main without a version bump.
//
// Two PRs that bump to the same version merge cleanly, because git sees the
// same edit on both sides. The second PR's changes then never reach npm, since
// that version is already published. This guard lists commits on main after the
// commit that set the current version whose Conventional Commits type needs a
// release, unless their PR has the `skip-release` label.
//
// Usage (CI): node scripts/release-guard.mjs --since <sha> [--until <sha>]

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nextVersion, suggestBump } from './version-check.mjs'

const BUMP_ORDER = ['patch', 'minor', 'major']

function bumpOf(commit) {
  try {
    return suggestBump({ title: commit.subject, body: commit.body ?? '', labels: commit.labels ?? [] }).bump
  } catch {
    return 'skip'
  }
}

export function unreleasedChanges(commits) {
  return commits
    .map((commit) => ({ ...commit, bump: bumpOf(commit) }))
    .filter((commit) => commit.bump !== 'skip')
}

export function requiredBump(changes) {
  return changes.reduce(
    (max, { bump }) => (BUMP_ORDER.indexOf(bump) > BUMP_ORDER.indexOf(max) ? bump : max),
    'patch'
  )
}

export function formatFailure(version, changes) {
  const bump = requiredBump(changes)
  return [
    `These commits reached main after ${version} was set, so they are not on npm:`,
    ...changes.map(({ sha, subject }) => `- ${sha.slice(0, 7)} ${subject}`),
    '',
    `Open a PR that bumps the version to ${nextVersion(version, bump)} (${bump}):`,
    `  npm version ${bump} --no-git-tag-version`,
  ].join('\n')
}

function commitsBetween(since, until) {
  const out = execFileSync('git', ['log', '--format=%H%x09%s%x09%b%x00', `${since}..${until}`], {
    encoding: 'utf8',
  })
  return out
    .split('\0')
    .map((record) => record.replace(/^\n+/, ''))
    .filter(Boolean)
    .map((record) => {
      const [sha, subject, ...body] = record.split('\t')
      return { sha, subject, body: body.join('\t') }
    })
}

function prLabels(sha) {
  const repo = process.env.GITHUB_REPOSITORY
  if (!repo) return []
  try {
    const out = execFileSync(
      'gh',
      ['api', `repos/${repo}/commits/${sha}/pulls`, '--jq', '.[].labels[].name'],
      { encoding: 'utf8' }
    )
    return out.split('\n').filter(Boolean)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not read the PR labels of ${sha.slice(0, 7)}: ${message}`)
  }
}

function argValue(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function main() {
  const since = argValue('--since')
  const until = argValue('--until') ?? 'HEAD'
  if (!since) {
    console.error('[ERROR] --since <sha> is required.')
    return 1
  }
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version
  let changes
  try {
    // Look up labels only for commits whose title needs a release: one API call each.
    const candidates = unreleasedChanges(commitsBetween(since, until))
    changes = unreleasedChanges(candidates.map((c) => ({ ...c, labels: prLabels(c.sha) })))
  } catch (error) {
    console.error(`[ERROR] ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
  if (changes.length === 0) {
    console.log(`No unreleased changes after ${version}.`)
    return 0
  }
  console.error(formatFailure(version, changes))
  return 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main())
}
