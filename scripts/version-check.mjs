#!/usr/bin/env node
// Zero-dependency PR version gate.
//
// Developers bump `version` in package.json inside their pull request
// (`npm version <patch|minor|major> --no-git-tag-version`). This script checks
// that bump against the latest release and suggests a bump from the PR's
// Conventional Commits title, body, and labels.
//
// Usage (CI):
//   node scripts/version-check.mjs --base-root . --pr-package pr/package.json \
//     --report-file report.md
// PR metadata comes from the PR_TITLE, PR_BODY, and PR_LABELS env vars.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKIP_TYPES = new Set(['docs', 'chore', 'ci', 'test', 'style', 'build'])
const MINOR_TYPES = new Set(['feat'])
const PATCH_TYPES = new Set(['fix', 'perf', 'refactor', 'revert'])
const SKIP_LABELS = new Set(['skip-release', 'no-release'])
const BUMPS = ['major', 'minor', 'patch']

const CONVENTIONAL_TITLE = /^(?<type>[a-zA-Z0-9_-]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s*(?<desc>.+)$/
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE:\s*/m

export function parseSemver(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value ?? '').trim())
  return match ? match.slice(1).map(Number) : null
}

export function compareSemver(a, b) {
  const x = parseSemver(a)
  const y = parseSemver(b)
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] - y[i]
  }
  return 0
}

export function nextVersion(base, bump) {
  const [major, minor, patch] = parseSemver(base)
  if (bump === 'major') return `${major + 1}.0.0`
  if (bump === 'minor') return `${major}.${minor + 1}.0`
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`
  return base
}

export function parseLabels(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean)
  const text = String(raw).trim()
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) return parseLabels(parsed)
    } catch {
      // fall through to comma-separated parsing
    }
  }
  return text.split(',').map((s) => s.trim()).filter(Boolean)
}

// Returns { bump: 'major' | 'minor' | 'patch' | 'skip', reason }.
export function suggestBump({ title = '', body = '', labels = [] }) {
  const skipLabel = parseLabels(labels).find((l) => SKIP_LABELS.has(l.toLowerCase()))
  if (skipLabel) return { bump: 'skip', reason: `PR label '${skipLabel}'` }

  const cleanTitle = title.trim()
  const match = CONVENTIONAL_TITLE.exec(cleanTitle)
  if (!match) {
    throw new Error(
      `PR title '${cleanTitle}' does not follow Conventional Commits '<type>(<scope>): <description>'.`
    )
  }
  const type = match.groups.type.toLowerCase()
  if (match.groups.breaking) return { bump: 'major', reason: "'!' in PR title" }
  if (BREAKING_FOOTER.test(body)) return { bump: 'major', reason: 'BREAKING CHANGE footer in PR body' }
  if (MINOR_TYPES.has(type)) return { bump: 'minor', reason: `type '${type}'` }
  if (PATCH_TYPES.has(type)) return { bump: 'patch', reason: `type '${type}'` }
  if (SKIP_TYPES.has(type)) return { bump: 'skip', reason: `type '${type}' does not release` }
  throw new Error(`Unknown Conventional Commits type '${type}'.`)
}

// Returns 'none' | 'major' | 'minor' | 'patch' | 'lower' | 'invalid'.
export function classifyBump(base, version) {
  if (!parseSemver(base) || !parseSemver(version)) return 'invalid'
  const cmp = compareSemver(version, base)
  if (cmp === 0) return 'none'
  if (cmp < 0) return 'lower'
  return BUMPS.find((bump) => nextVersion(base, bump) === version) ?? 'invalid'
}

export function checkVersion(base, version, suggestion) {
  const errors = []
  const warnings = []
  const actual = classifyBump(base, version)

  if (!parseSemver(version)) {
    errors.push(`Version '${version}' is not valid SemVer (expected X.Y.Z).`)
  } else if (actual === 'lower') {
    errors.push(`Version ${version} is lower than the latest release ${base}.`)
  } else if (actual === 'invalid') {
    const valid = ['patch', 'minor', 'major'].map((b) => nextVersion(base, b)).join(', ')
    errors.push(`Version ${version} is not a single step from ${base}. Valid next versions: ${valid}.`)
  } else if (actual === 'none') {
    if (suggestion.bump !== 'skip') {
      errors.push(
        `Version was not bumped from ${base}, but this PR needs a ${suggestion.bump} release ` +
          `(${suggestion.reason}). Bump the version, or add the 'skip-release' label.`
      )
    }
  } else if (suggestion.bump === 'major' && actual !== 'major') {
    errors.push(
      `This PR is a breaking change (${suggestion.reason}) but the bump is ${actual}. ` +
        `Bump major to ${nextVersion(base, 'major')}.`
    )
  } else if (suggestion.bump !== 'skip' && suggestion.bump !== actual) {
    warnings.push(
      `Bump is ${actual} but the PR title suggests ${suggestion.bump} (${suggestion.reason}). ` +
        `Keep it if the scope really is ${actual}.`
    )
  }

  const ok = errors.length === 0
  return { ok, release: ok && BUMPS.includes(actual), actual, errors, warnings }
}

export function formatReport(base, version, suggestion, result) {
  const lines = [
    `### Version check: ${result.ok ? 'Passed' : 'Failed'}`,
    '',
    `- Latest release: \`${base}\``,
    `- Version in this PR: \`${version}\``,
    suggestion.bump === 'skip'
      ? `- Suggested bump: none (${suggestion.reason})`
      : `- Suggested bump: **${suggestion.bump}** to \`${nextVersion(base, suggestion.bump)}\` (${suggestion.reason})`,
  ]
  if (result.ok) {
    lines.push(result.release ? `- On merge: publish \`${version}\` to npm` : '- On merge: no release')
  }
  for (const error of result.errors) lines.push(`- :x: ${error}`)
  for (const warning of result.warnings) lines.push(`- :warning: ${warning}`)
  lines.push(
    '',
    'Bump the version on your branch, then commit:',
    '',
    '```bash',
    'npm version <patch|minor|major> --no-git-tag-version',
    '```'
  )
  return lines.join('\n') + '\n'
}

// Highest X.Y.Z among tags named `X.Y.Z` or `vX.Y.Z`.
export function latestTagVersion(tags) {
  const versions = tags
    .map((tag) => /^v?(\d+\.\d+\.\d+)$/.exec(tag.trim())?.[1])
    .filter(Boolean)
  return versions.sort(compareSemver).at(-1) ?? null
}

// The base is the latest release tag, raised to the base branch's package.json
// version. The base branch can be ahead of the tags while a merged PR's release is
// pending or failed; without that floor a second PR with the same version would pass.
export function resolveBase(tagVersion, baseBranchVersion) {
  const candidates = [tagVersion, baseBranchVersion].filter((v) => parseSemver(v))
  if (candidates.length === 0) throw new Error('No release tag and no valid version on the base branch.')
  return candidates.sort(compareSemver).at(-1)
}

function readVersion(path) {
  return JSON.parse(readFileSync(path, 'utf8')).version
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1]
  return args
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const baseRoot = resolve(args['base-root'] ?? '.')
  const reportFile = args['report-file']
  const write = (text) => reportFile && writeFileSync(reportFile, text)

  try {
    const tags = execFileSync('git', ['tag', '-l'], { cwd: baseRoot, encoding: 'utf8' }).split('\n')
    const base = resolveBase(latestTagVersion(tags), readVersion(join(baseRoot, 'package.json')))
    const version = readVersion(resolve(args['pr-package'] ?? join(baseRoot, 'package.json')))
    const suggestion = suggestBump({
      title: process.env.PR_TITLE ?? '',
      body: process.env.PR_BODY ?? '',
      labels: process.env.PR_LABELS ?? '',
    })
    const result = checkVersion(base, version, suggestion)
    const report = formatReport(base, version, suggestion, result)
    console.log(report)
    write(report)
    return result.ok ? 0 : 1
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[ERROR] ${message}`)
    write(`### Version check: Failed\n\n- :x: ${message}\n`)
    return 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main())
}
