import { execSync } from 'child_process'

export type RepoContext = {
  workspace: string
  repo: string
}

export function getRepoContext(): RepoContext {
  let url: string
  try {
    url = (execSync('git remote get-url origin', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }) as string).trim()
  } catch {
    throw new Error('Could not detect workspace/repo from git remote origin.')
  }

  const httpsMatch = url.match(
    /^https?:\/\/(?:[^@]+@)?bitbucket\.org\/([^/]+)\/([^/]+?)(?:\.git)?$/
  )
  if (httpsMatch) return { workspace: httpsMatch[1], repo: httpsMatch[2] }

  const sshMatch = url.match(/^git@(?:\w[\w.-]*\.)?bitbucket\.org:([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (sshMatch) return { workspace: sshMatch[1], repo: sshMatch[2] }

  throw new Error('Remote origin is not a Bitbucket repository.')
}

export function getCurrentBranch(): string {
  let branch: string
  try {
    branch = (execSync('git branch --show-current', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }) as string).trim()
  } catch {
    throw new Error('Could not detect current branch. Are you in a git repo?')
  }
  if (!branch) throw new Error('Could not detect current branch. Are you in a git repo?')
  return branch
}

export function detectDefaultTarget(): string {
  let output: string
  try {
    output = (execSync('git branch -a', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }) as string)
  } catch {
    throw new Error('Could not detect default target branch. Use --target <branch>.')
  }
  const branches = output.split('\n').map(l => l.replace(/^\*\s+/, '').trim()).filter(Boolean)
  for (const candidate of ['main', 'master']) {
    if (branches.some(b => b === candidate || new RegExp(`^remotes/[^/]+/${candidate}$`).test(b))) {
      return candidate
    }
  }
  throw new Error('Could not detect default target branch. Use --target <branch>.')
}
