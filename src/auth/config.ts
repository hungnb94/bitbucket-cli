import Conf from 'conf'
import os from 'os'
import path from 'path'
import fs from 'fs'

export type Credentials = {
  email: string
  apiToken: string
}

type Schema = Credentials

const store = new Conf<Schema>({
  projectName: 'bitbucket-cli',
  cwd: path.join(os.homedir(), '.config', 'bitbucket-cli'),
})

export function getCredentials(): Credentials | null {
  const email = process.env.BITBUCKET_EMAIL ?? (store.get('email') as string | undefined)
  const apiToken = process.env.BITBUCKET_API_TOKEN ?? (store.get('apiToken') as string | undefined)
  if (!email || !apiToken) return null
  return { email, apiToken }
}

export function saveCredentials(creds: Credentials): void {
  store.set('email', creds.email)
  store.set('apiToken', creds.apiToken)
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
