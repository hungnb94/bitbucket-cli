import Conf from 'conf'
import os from 'os'
import path from 'path'
import fs from 'fs'

export type Credentials = {
  username: string
  apiToken: string
  defaultWorkspace: string
  defaultRepo?: string
}

type Schema = {
  username: string
  apiToken: string
  defaultWorkspace: string
  defaultRepo: string
}

const store = new Conf<Schema>({
  projectName: 'bitbucket-cli',
  cwd: path.join(os.homedir(), '.config', 'bitbucket-cli'),
})

export function getCredentials(): Credentials | null {
  // Environment variables take precedence over config file (useful for CI)
  const username = process.env.BITBUCKET_USERNAME ?? (store.get('username') as string | undefined)
  const apiToken = process.env.BITBUCKET_API_TOKEN ?? (store.get('apiToken') as string | undefined)
  const defaultWorkspace = store.get('defaultWorkspace') as string | undefined
  if (!username || !apiToken || !defaultWorkspace) return null
  return {
    username,
    apiToken,
    defaultWorkspace,
    defaultRepo: store.get('defaultRepo') as string | undefined,
  }
}

export function saveCredentials(creds: Credentials): void {
  store.set('username', creds.username)
  store.set('apiToken', creds.apiToken)
  store.set('defaultWorkspace', creds.defaultWorkspace)
  if (creds.defaultRepo) store.set('defaultRepo', creds.defaultRepo)
  try {
    fs.chmodSync(store.path, 0o600)
  } catch {
    // chmod not supported on all platforms (e.g. Windows)
  }
}

export function clearCredentials(): void {
  store.clear()
}

export function getConfigPath(): string {
  return store.path
}
