import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'

// Mock auth module
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

// Mock @inquirer/prompts
const mockInput = vi.fn()
const mockPassword = vi.fn()
const mockConfirm = vi.fn()

vi.mock('@inquirer/prompts', () => ({
  input: mockInput,
  password: mockPassword,
  confirm: mockConfirm,
}))

// Mock ora
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
    mockInput
      .mockResolvedValueOnce('johndoe')        // username
      .mockResolvedValueOnce('my-team')        // workspace
      .mockResolvedValueOnce('my-project')     // repo
    mockPassword.mockResolvedValueOnce('my-token')
    mockValidateCredentials.mockResolvedValueOnce({
      username: 'johndoe',
      displayName: 'John Doe',
      accountId: '557058:xxxx',
    })

    await runCommand(['auth', 'login'])

    expect(mockSaveCredentials).toHaveBeenCalledWith({
      username: 'johndoe',
      apiToken: 'my-token',
      defaultWorkspace: 'my-team',
      defaultRepo: 'my-project',
    })
  })

  it('does not save credentials when validation fails', async () => {
    mockInput
      .mockResolvedValueOnce('johndoe')
      .mockResolvedValueOnce('my-team')
      .mockResolvedValueOnce('')
    mockPassword.mockResolvedValueOnce('bad-token')
    mockValidateCredentials.mockRejectedValueOnce(new Error('401 Unauthorized'))

    await expect(runCommand(['auth', 'login'])).rejects.toThrow()

    expect(mockSaveCredentials).not.toHaveBeenCalled()
  })

  it('saves undefined defaultRepo when repo input is empty', async () => {
    mockInput
      .mockResolvedValueOnce('johndoe')
      .mockResolvedValueOnce('my-team')
      .mockResolvedValueOnce('')             // empty repo
    mockPassword.mockResolvedValueOnce('my-token')
    mockValidateCredentials.mockResolvedValueOnce({
      username: 'johndoe', displayName: 'John Doe', accountId: '557058:xxxx',
    })

    await runCommand(['auth', 'login'])

    expect(mockSaveCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ defaultRepo: undefined })
    )
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
    mockGetCredentials.mockReturnValueOnce({
      username: 'johndoe', apiToken: 'token', defaultWorkspace: 'ws',
    })
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
