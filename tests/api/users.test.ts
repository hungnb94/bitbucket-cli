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
    mockGet.mockResolvedValue({
      data: { values: [{ user: { uuid: '{uuid-alice}', display_name: 'Alice' } }] },
    })
    const result = await getUserByUsername('myworkspace', 'alice')
    expect(result).toEqual({ uuid: '{uuid-alice}', displayName: 'Alice' })
    expect(mockGet).toHaveBeenCalledWith('/workspaces/myworkspace/members', {
      params: { q: 'nickname="alice"' },
    })
  })

  it('throws "Reviewer not found: <username>" when values is empty', async () => {
    mockGet.mockResolvedValue({ data: { values: [] } })
    await expect(getUserByUsername('myworkspace', 'ghost')).rejects.toThrow(
      'Reviewer not found: ghost'
    )
  })

  it('propagates non-404 axios errors as throwApiError messages', async () => {
    const err = Object.assign(new Error('Server Error'), {
      isAxiosError: true,
      response: { status: 500 },
    })
    mockGet.mockRejectedValue(err)
    await expect(getUserByUsername('myworkspace', 'alice')).rejects.toThrow(
      'Request failed with status 500'
    )
  })
})
