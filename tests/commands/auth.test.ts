import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'

const mockGetCredentials = vi.fn()
const mockSaveCredentials = vi.fn()
const mockClearCredentials = vi.fn()
const mockValidateCredentials = vi.fn()
const mockGetConfigPath = vi.fn().mockReturnValue('/mock/.config/bitbucket-cli/config.json')

vi.mock('../../src/auth/index.js', () => ({
  getCredentials: mockGetCredentials,
  saveCredentials: mockSaveCredentials,
  clearCredentials: mockClearCredentials,
  validateCredentials: mockValidateCredentials,
  getConfigPath: mockGetConfigPath,
}))

const mockInput = vi.fn()
const mockPassword = vi.fn()
const mockConfirm = vi.fn()

vi.mock('@inquirer/prompts', () => ({
  input: mockInput,
  password: mockPassword,
  confirm: mockConfirm,
}))

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}))

const { createAuthCommand } = await import('../../src/commands/auth.js')

beforeEach(() => {
  vi.clearAllMocks()
})

async function runCommand(args: string[]): Promise<void> {
  const program = new Command()
  program.addCommand(createAuthCommand())
  program.exitOverride()
  await program.parseAsync(['node', 'bitbucket', ...args])
}

describe('auth login', () => {
  it('saves credentials after successful validation', async () => {
    mockInput.mockResolvedValueOnce('user@example.com')   // email
    mockPassword.mockResolvedValueOnce('my-token')
    mockValidateCredentials.mockResolvedValueOnce({
      username: 'johndoe',
      displayName: 'John Doe',
      accountId: '557058:xxxx',
    })

    await runCommand(['auth', 'login'])

    expect(mockSaveCredentials).toHaveBeenCalledWith({
      email: 'user@example.com',
      apiToken: 'my-token',
    })
  })

  it('does not save credentials when validation fails', async () => {
    mockInput.mockResolvedValueOnce('user@example.com')
    mockPassword.mockResolvedValueOnce('bad-token')
    mockValidateCredentials.mockRejectedValueOnce(new Error('401 Unauthorized'))

    await expect(runCommand(['auth', 'login'])).rejects.toThrow()

    expect(mockSaveCredentials).not.toHaveBeenCalled()
  })
})

describe('auth logout', () => {
  it('clears credentials when user confirms', async () => {
    mockConfirm.mockResolvedValueOnce(true)

    await runCommand(['auth', 'logout'])

    expect(mockClearCredentials).toHaveBeenCalled()
  })

  it('does not clear credentials when user declines', async () => {
    mockConfirm.mockResolvedValueOnce(false)

    await runCommand(['auth', 'logout'])

    expect(mockClearCredentials).not.toHaveBeenCalled()
  })
})

describe('auth whoami', () => {
  it('prints user info when credentials exist', async () => {
    mockGetCredentials.mockReturnValueOnce({ email: 'user@example.com', apiToken: 'token' })
    mockValidateCredentials.mockResolvedValueOnce({
      username: 'johndoe',
      displayName: 'John Doe',
      accountId: '557058:xxxx',
    })
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await runCommand(['auth', 'whoami'])

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('johndoe'))
    consoleSpy.mockRestore()
  })

  it('exits with error when not logged in', async () => {
    mockGetCredentials.mockReturnValueOnce(null)

    await expect(runCommand(['auth', 'whoami'])).rejects.toThrow()
  })
})
