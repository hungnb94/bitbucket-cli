import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockData: Record<string, unknown> = {}
const mockPath = '/mock/.config/bitbucket-cli/config.json'

vi.mock('conf', () => ({
  default: vi.fn(function () {
    return {
      get: (key: string) => mockData[key],
      set: (key: string, val: unknown) => { mockData[key] = val },
      clear: () => { Object.keys(mockData).forEach(k => delete mockData[k]) },
      path: mockPath,
    }
  }),
}))

vi.mock('fs', () => ({
  default: { chmodSync: vi.fn() },
  chmodSync: vi.fn(),
}))

const { getCredentials, saveCredentials, clearCredentials, getConfigPath, getAuthState } =
  await import('../../src/auth/config.js')

afterEach(() => {
  delete process.env.BITBUCKET_EMAIL
  delete process.env.BITBUCKET_API_TOKEN
})

beforeEach(() => {
  Object.keys(mockData).forEach(k => delete mockData[k])
})

describe('getCredentials', () => {
  it('returns null when no credentials saved', () => {
    expect(getCredentials()).toBeNull()
  })

  it('returns null when email is missing', () => {
    mockData['apiToken'] = 'token'
    expect(getCredentials()).toBeNull()
  })

  it('returns null when apiToken is missing', () => {
    mockData['email'] = 'user@example.com'
    expect(getCredentials()).toBeNull()
  })

  it('returns credentials when both fields are present', () => {
    mockData['email'] = 'user@example.com'
    mockData['apiToken'] = 'my-token'
    expect(getCredentials()).toEqual({
      email: 'user@example.com',
      apiToken: 'my-token',
    })
  })
})

describe('saveCredentials', () => {
  it('saves email and apiToken', () => {
    saveCredentials({ email: 'user@example.com', apiToken: 'token' })
    expect(mockData['email']).toBe('user@example.com')
    expect(mockData['apiToken']).toBe('token')
  })
})

describe('clearCredentials', () => {
  it('removes all stored data', () => {
    mockData['email'] = 'user@example.com'
    mockData['apiToken'] = 'token'
    clearCredentials()
    expect(Object.keys(mockData)).toHaveLength(0)
  })
})

describe('getConfigPath', () => {
  it('returns the conf store path', () => {
    expect(getConfigPath()).toBe(mockPath)
  })
})

describe('env var override', () => {
  it('uses BITBUCKET_EMAIL and BITBUCKET_API_TOKEN over config file values', () => {
    mockData['email'] = 'config@example.com'
    mockData['apiToken'] = 'config-token'
    process.env.BITBUCKET_EMAIL = 'env@example.com'
    process.env.BITBUCKET_API_TOKEN = 'env-token'

    const creds = getCredentials()

    expect(creds?.email).toBe('env@example.com')
    expect(creds?.apiToken).toBe('env-token')
  })
})

describe('getAuthState', () => {
  it('returns source:none when nothing is set', () => {
    expect(getAuthState()).toEqual({ source: 'none' })
  })

  it('returns source:none when only email env var is set', () => {
    process.env.BITBUCKET_EMAIL = 'env@example.com'
    expect(getAuthState()).toEqual({ source: 'none' })
  })

  it('returns source:none when only token env var is set', () => {
    process.env.BITBUCKET_API_TOKEN = 'env-token'
    expect(getAuthState()).toEqual({ source: 'none' })
  })

  it('returns source:env when both env vars are set', () => {
    process.env.BITBUCKET_EMAIL = 'env@example.com'
    process.env.BITBUCKET_API_TOKEN = 'env-token'
    expect(getAuthState()).toEqual({
      source: 'env',
      credentials: { email: 'env@example.com', apiToken: 'env-token' },
    })
  })

  it('returns source:env even when file creds also exist', () => {
    mockData['email'] = 'file@example.com'
    mockData['apiToken'] = 'file-token'
    process.env.BITBUCKET_EMAIL = 'env@example.com'
    process.env.BITBUCKET_API_TOKEN = 'env-token'
    expect(getAuthState()).toEqual({
      source: 'env',
      credentials: { email: 'env@example.com', apiToken: 'env-token' },
    })
  })

  it('returns source:file when file creds exist and no env vars', () => {
    mockData['email'] = 'file@example.com'
    mockData['apiToken'] = 'file-token'
    expect(getAuthState()).toEqual({
      source: 'file',
      credentials: { email: 'file@example.com', apiToken: 'file-token' },
    })
  })

  it('returns source:none when only email is in file', () => {
    mockData['email'] = 'file@example.com'
    expect(getAuthState()).toEqual({ source: 'none' })
  })

  it('returns source:none when only token is in file', () => {
    mockData['apiToken'] = 'file-token'
    expect(getAuthState()).toEqual({ source: 'none' })
  })
})
