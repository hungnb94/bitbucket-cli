import Conf from 'conf'
import os from 'os'
import path from 'path'
import fs from 'fs'

export type Credentials = {
  email: string
  apiToken: string
}

export type AuthState =
  | { source: 'env'; credentials: Credentials }
  | { source: 'file'; credentials: Credentials }
  | { source: 'none' }

type Schema = Credentials

const store = new Conf<Schema>({
  projectName: 'bitbucket-cli',
  cwd: path.join(os.homedir(), '.config', 'bitbucket-cli'),
})

export function getAuthState(): AuthState {
  const envEmail = process.env.BITBUCKET_EMAIL
  const envToken = process.env.BITBUCKET_API_TOKEN
  if (envEmail && envToken) {
    return { source: 'env', credentials: { email: envEmail, apiToken: envToken } }
  }
  const fileEmail = store.get('email') as string | undefined
  const fileToken = store.get('apiToken') as string | undefined
  if (fileEmail && fileToken) {
    return { source: 'file', credentials: { email: fileEmail, apiToken: fileToken } }
  }
  return { source: 'none' }
}

export function getCredentials(): Credentials | null {
  const state = getAuthState()
  return state.source === 'none' ? null : state.credentials
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
