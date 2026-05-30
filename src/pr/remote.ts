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

  const sshMatch = url.match(/^git@bitbucket\.org:([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (sshMatch) return { workspace: sshMatch[1], repo: sshMatch[2] }

  throw new Error('Remote origin is not a Bitbucket repository.')
}
