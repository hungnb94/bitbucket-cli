import { describe, it, expect, vi, beforeEach } from 'vitest'

// Module-level mock data — shared across the mock and the imported module
const mockData: Record<string, unknown> = {}
const mockPath = '/mock/.config/bitbucket-cli/config.json'

vi.mock('conf', () => ({
  default: vi.fn(() => ({
    get: (key: string) => mockData[key],
    set: (key: string, val: unknown) => { mockData[key] = val },
    clear: () => { Object.keys(mockData).forEach(k => delete mockData[k]) },
    path: mockPath,
  })),
}))

vi.mock('fs', () => ({
  default: { chmodSync: vi.fn() },
  chmodSync: vi.fn(),
}))

const { getCredentials, saveCredentials, clearCredentials, getConfigPath } =
  await import('../../src/auth/config.js')

beforeEach(() => {
  Object.keys(mockData).forEach(k => delete mockData[k])
})

describe('getCredentials', () => {
  it('returns null when no credentials saved', () => {
    expect(getCredentials()).toBeNull()
  })

  it('returns null when username is missing', () => {
    mockData['apiToken'] = 'token'
    mockData['defaultWorkspace'] = 'ws'
    expect(getCredentials()).toBeNull()
  })

  it('returns null when apiToken is missing', () => {
    mockData['username'] = 'johndoe'
    mockData['defaultWorkspace'] = 'ws'
    expect(getCredentials()).toBeNull()
  })

  it('returns null when defaultWorkspace is missing', () => {
    mockData['username'] = 'johndoe'
    mockData['apiToken'] = 'token'
    expect(getCredentials()).toBeNull()
  })

  it('returns full credentials when all required fields are present', () => {
    mockData['username'] = 'johndoe'
    mockData['apiToken'] = 'my-token'
    mockData['defaultWorkspace'] = 'my-team'
    expect(getCredentials()).toEqual({
      username: 'johndoe',
      apiToken: 'my-token',
      defaultWorkspace: 'my-team',
      defaultRepo: undefined,
    })
  })

  it('includes defaultRepo when present', () => {
    mockData['username'] = 'johndoe'
    mockData['apiToken'] = 'my-token'
    mockData['defaultWorkspace'] = 'my-team'
    mockData['defaultRepo'] = 'my-project'
    expect(getCredentials()).toEqual({
      username: 'johndoe',
      apiToken: 'my-token',
      defaultWorkspace: 'my-team',
      defaultRepo: 'my-project',
    })
  })
})

describe('saveCredentials', () => {
  it('saves all required fields', () => {
    saveCredentials({ username: 'johndoe', apiToken: 'token', defaultWorkspace: 'ws' })
    expect(mockData['username']).toBe('johndoe')
    expect(mockData['apiToken']).toBe('token')
    expect(mockData['defaultWorkspace']).toBe('ws')
  })

  it('saves defaultRepo when provided', () => {
    saveCredentials({ username: 'johndoe', apiToken: 'token', defaultWorkspace: 'ws', defaultRepo: 'repo' })
    expect(mockData['defaultRepo']).toBe('repo')
  })

  it('does not save defaultRepo when undefined', () => {
    saveCredentials({ username: 'johndoe', apiToken: 'token', defaultWorkspace: 'ws' })
    expect(mockData['defaultRepo']).toBeUndefined()
  })
})

describe('clearCredentials', () => {
  it('removes all stored data', () => {
    mockData['username'] = 'johndoe'
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
  it('uses BITBUCKET_USERNAME and BITBUCKET_API_TOKEN over config file values', () => {
    mockData['username'] = 'from-config'
    mockData['apiToken'] = 'config-token'
    mockData['defaultWorkspace'] = 'ws'
    process.env.BITBUCKET_USERNAME = 'from-env'
    process.env.BITBUCKET_API_TOKEN = 'env-token'

    const creds = getCredentials()

    expect(creds?.username).toBe('from-env')
    expect(creds?.apiToken).toBe('env-token')

    delete process.env.BITBUCKET_USERNAME
    delete process.env.BITBUCKET_API_TOKEN
  })
})
