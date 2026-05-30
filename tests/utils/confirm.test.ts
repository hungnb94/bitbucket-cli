import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockConfirm = vi.fn()
vi.mock('@inquirer/prompts', () => ({ confirm: mockConfirm }))

const { resolveConfirm } = await import('../../src/utils/confirm.js')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolveConfirm', () => {
  it('returns true immediately when yes is true', async () => {
    const result = await resolveConfirm(true, 'Are you sure?')
    expect(result).toBe(true)
    expect(mockConfirm).not.toHaveBeenCalled()
  })

  it('calls confirm prompt when yes is false', async () => {
    mockConfirm.mockResolvedValueOnce(true)
    const result = await resolveConfirm(false, 'Are you sure?')
    expect(result).toBe(true)
    expect(mockConfirm).toHaveBeenCalledWith({ message: 'Are you sure?', default: false })
  })

  it('returns false when user declines prompt', async () => {
    mockConfirm.mockResolvedValueOnce(false)
    const result = await resolveConfirm(false, 'Are you sure?')
    expect(result).toBe(false)
  })
})
