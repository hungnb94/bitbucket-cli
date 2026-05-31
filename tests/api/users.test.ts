import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios')
vi.mock('../../src/auth/index.js', () => ({
  getCredentials: vi.fn().mockReturnValue({ email: 'user@example.com', apiToken: 'token' }),
  buildBasicAuth: vi.fn().mockReturnValue('Basic dXNlckBleGFtcGxlLmNvbTp0b2tlbg=='),
}))

const mockGet = vi.fn()

const { getUserByUsername } = await import('../../src/api/users.js')

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(axios.create).mockReturnValue({ get: mockGet } as any)
  vi.mocked(axios.isAxiosError).mockImplementation((value) => value?.isAxiosError === true)
})

describe('getUserByUsername', () => {
  it('returns uuid and displayName for a valid username', async () => {
    mockGet.mockResolvedValue({ data: { uuid: '{uuid-alice}', display_name: 'Alice' } })
    const result = await getUserByUsername('alice')
    expect(result).toEqual({ uuid: '{uuid-alice}', displayName: 'Alice' })
    expect(mockGet).toHaveBeenCalledWith('/users/alice')
  })

  it('throws "Reviewer not found: <username>" on 404', async () => {
    const err = Object.assign(new Error('Not Found'), {
      isAxiosError: true,
      response: { status: 404 },
    })
    mockGet.mockRejectedValue(err)
    await expect(getUserByUsername('ghost')).rejects.toThrow('Reviewer not found: ghost')
  })

  it('propagates non-404 axios errors as throwApiError messages', async () => {
    const err = Object.assign(new Error('Server Error'), {
      isAxiosError: true,
      response: { status: 500 },
    })
    mockGet.mockRejectedValue(err)
    await expect(getUserByUsername('alice')).rejects.toThrow('Request failed with status 500')
  })
})
