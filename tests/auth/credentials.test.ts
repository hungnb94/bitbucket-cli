import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios')

const mockedAxios = vi.mocked(axios)

const { validateCredentials } = await import('../../src/auth/credentials.js')

const mockCreds = { email: 'user@example.com', apiToken: 'valid-token' }
const expectedAuth = 'Basic ' + Buffer.from('user@example.com:valid-token').toString('base64')

beforeEach(() => {
  vi.clearAllMocks()
})

function makeAxiosError(status: number | null, code?: string): Error {
  const err = new Error('axios error') as Error & {
    isAxiosError: boolean
    response?: { status: number }
    code?: string
  }
  err.isAxiosError = true
  if (status !== null) err.response = { status }
  if (code) err.code = code
  vi.mocked(axios.isAxiosError).mockReturnValue(true)
  return err
}

describe('validateCredentials', () => {
  it('returns UserInfo on successful API response', async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({
      data: {
        username: 'johndoe',
        display_name: 'John Doe',
        account_id: '557058:xxxx-yyyy',
      },
    })
    vi.mocked(axios.isAxiosError).mockReturnValue(false)

    const result = await validateCredentials(mockCreds)

    expect(result).toEqual({
      username: 'johndoe',
      displayName: 'John Doe',
      accountId: '557058:xxxx-yyyy',
    })
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.bitbucket.org/2.0/user',
      expect.objectContaining({
        headers: { Authorization: expectedAuth },
        timeout: 10000,
      })
    )
  })

  it('throws "401 Unauthorized" on 401 response', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue(makeAxiosError(401))

    await expect(validateCredentials(mockCreds)).rejects.toThrow('401 Unauthorized')
  })

  it('throws scope error message on 403 response', async () => {
    mockedAxios.get = vi.fn().mockRejectedValue(makeAxiosError(403))

    await expect(validateCredentials(mockCreds)).rejects.toThrow(
      'token missing required scopes, check your token scopes'
    )
  })

  it('retries once on timeout and returns result', async () => {
    const timeoutError = makeAxiosError(null, 'ECONNABORTED')
    mockedAxios.get = vi.fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce({
        data: { username: 'johndoe', display_name: 'John Doe', account_id: '557058:xxxx' },
      })

    const result = await validateCredentials(mockCreds)

    expect(result.username).toBe('johndoe')
    expect(mockedAxios.get).toHaveBeenCalledTimes(2)
  })

  it('retries once on ETIMEDOUT and returns result', async () => {
    const timeoutError = makeAxiosError(null, 'ETIMEDOUT')
    mockedAxios.get = vi.fn()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce({
        data: { username: 'johndoe', display_name: 'John Doe', account_id: '557058:xxxx' },
      })

    const result = await validateCredentials(mockCreds)

    expect(result.username).toBe('johndoe')
    expect(mockedAxios.get).toHaveBeenCalledTimes(2)
  })

  it('throws network error message after retry also fails', async () => {
    const timeoutError = makeAxiosError(null, 'ECONNABORTED')
    mockedAxios.get = vi.fn().mockRejectedValue(timeoutError)

    await expect(validateCredentials(mockCreds)).rejects.toThrow(
      'Connection failed after retry'
    )
  })

  it('throws auth error when retry gets 401', async () => {
    const timeoutError = makeAxiosError(null, 'ECONNABORTED')
    const authError = makeAxiosError(401)
    mockedAxios.get = vi.fn()
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(authError)

    await expect(validateCredentials(mockCreds)).rejects.toThrow('401 Unauthorized')
  })

  it('re-throws non-axios errors as-is', async () => {
    const unknownError = new Error('something broke')
    mockedAxios.get = vi.fn().mockRejectedValue(unknownError)
    vi.mocked(axios.isAxiosError).mockReturnValue(false)

    await expect(validateCredentials(mockCreds)).rejects.toThrow('something broke')
  })
})
