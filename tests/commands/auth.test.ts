import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Command } from 'commander'

const mockGetAuthState = vi.fn()
const mockGetCredentials = vi.fn()
const mockSaveCredentials = vi.fn()
const mockClearCredentials = vi.fn()
const mockValidateCredentials = vi.fn()
const mockGetConfigPath = vi.fn().mockReturnValue('/mock/.config/bitbucket-cli/config.json')

vi.mock('../../src/auth/index.js', () => ({
  getAuthState: mockGetAuthState,
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
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`)
  })
})

async function runCommand(args: string[]): Promise<void> {
  const program = new Command()
  program.addCommand(createAuthCommand())
  program.exitOverride()
  await program.parseAsync(['node', 'bitbucket', ...args])
}

describe('auth login', () => {
  it('saves credentials after successful validation', async () => {
    mockGetAuthState.mockReturnValueOnce({ source: 'none' })
    mockInput.mockResolvedValueOnce('user@example.com')
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
    mockGetAuthState.mockReturnValueOnce({ source: 'none' })
    mockInput.mockResolvedValueOnce('user@example.com')
    mockPassword.mockResolvedValueOnce('bad-token')
    mockValidateCredentials.mockRejectedValueOnce(new Error('401 Unauthorized'))

    await expect(runCommand(['auth', 'login'])).rejects.toThrow()

    expect(mockSaveCredentials).not.toHaveBeenCalled()
  })

  it('exits with error when credentials are set via env vars', async () => {
    mockGetAuthState.mockReturnValueOnce({
      source: 'env',
      credentials: { email: 'env@example.com', apiToken: 'env-token' },
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(runCommand(['auth', 'login'])).rejects.toThrow()

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('BITBUCKET_EMAIL')
    )
    expect(mockInput).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('prompts for re-auth when already logged in without --yes and user confirms', async () => {
    mockGetAuthState.mockReturnValueOnce({
      source: 'file',
      credentials: { email: 'file@example.com', apiToken: 'file-token' },
    })
    mockConfirm.mockResolvedValueOnce(true)
    mockInput.mockResolvedValueOnce('file@example.com')
    mockPassword.mockResolvedValueOnce('new-token')
    mockValidateCredentials.mockResolvedValueOnce({
      username: 'johndoe',
      displayName: 'John Doe',
      accountId: '557058:xxxx',
    })

    await runCommand(['auth', 'login'])

    expect(mockSaveCredentials).toHaveBeenCalledWith({
      email: 'file@example.com',
      apiToken: 'new-token',
    })
  })

  it('aborts login when already logged in without --yes and user declines re-auth', async () => {
    mockGetAuthState.mockReturnValueOnce({
      source: 'file',
      credentials: { email: 'file@example.com', apiToken: 'file-token' },
    })
    mockConfirm.mockResolvedValueOnce(false)

    await runCommand(['auth', 'login'])

    expect(mockInput).not.toHaveBeenCalled()
    expect(mockSaveCredentials).not.toHaveBeenCalled()
  })

  it('proceeds to interactive login when already logged in with --yes', async () => {
    mockGetAuthState.mockReturnValueOnce({
      source: 'file',
      credentials: { email: 'file@example.com', apiToken: 'file-token' },
    })
    mockInput.mockResolvedValueOnce('file@example.com')
    mockPassword.mockResolvedValueOnce('new-token')
    mockValidateCredentials.mockResolvedValueOnce({
      username: 'johndoe',
      displayName: 'John Doe',
      accountId: '557058:xxxx',
    })

    await runCommand(['auth', 'login', '--yes'])

    expect(mockSaveCredentials).toHaveBeenCalledWith({
      email: 'file@example.com',
      apiToken: 'new-token',
    })
  })

  it('logs in non-interactively with --email and --token', async () => {
    mockGetAuthState.mockReturnValueOnce({ source: 'none' })
    mockValidateCredentials.mockResolvedValueOnce({
      username: 'johndoe',
      displayName: 'John Doe',
      accountId: '557058:xxxx',
    })

    await runCommand(['auth', 'login', '--email', 'user@example.com', '--token', 'my-token'])

    expect(mockInput).not.toHaveBeenCalled()
    expect(mockPassword).not.toHaveBeenCalled()
    expect(mockSaveCredentials).toHaveBeenCalledWith({
      email: 'user@example.com',
      apiToken: 'my-token',
    })
  })

  it('overwrites credentials non-interactively with --email --token --yes when already logged in', async () => {
    mockGetAuthState.mockReturnValueOnce({
      source: 'file',
      credentials: { email: 'old@example.com', apiToken: 'old-token' },
    })
    mockValidateCredentials.mockResolvedValueOnce({
      username: 'johndoe',
      displayName: 'John Doe',
      accountId: '557058:xxxx',
    })

    await runCommand(['auth', 'login', '--email', 'new@example.com', '--token', 'new-token', '--yes'])

    expect(mockInput).not.toHaveBeenCalled()
    expect(mockPassword).not.toHaveBeenCalled()
    expect(mockSaveCredentials).toHaveBeenCalledWith({
      email: 'new@example.com',
      apiToken: 'new-token',
    })
  })

  it('exits with error when --email is provided without --token', async () => {
    mockGetAuthState.mockReturnValueOnce({ source: 'none' })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      runCommand(['auth', 'login', '--email', 'user@example.com'])
    ).rejects.toThrow('process.exit(1)')

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('--email and --token must be used together')
    )
    errorSpy.mockRestore()
  })

  it('exits with error when --token is provided without --email', async () => {
    mockGetAuthState.mockReturnValueOnce({ source: 'none' })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      runCommand(['auth', 'login', '--token', 'my-token'])
    ).rejects.toThrow('process.exit(1)')

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('--email and --token must be used together')
    )
    errorSpy.mockRestore()
  })
})

describe('auth logout', () => {
  it('clears credentials when user confirms', async () => {
    mockGetAuthState.mockReturnValueOnce({
      source: 'file',
      credentials: { email: 'file@example.com', apiToken: 'file-token' },
    })
    mockConfirm.mockResolvedValueOnce(true)

    await runCommand(['auth', 'logout'])

    expect(mockClearCredentials).toHaveBeenCalled()
  })

  it('does not clear credentials when user declines', async () => {
    mockGetAuthState.mockReturnValueOnce({
      source: 'file',
      credentials: { email: 'file@example.com', apiToken: 'file-token' },
    })
    mockConfirm.mockResolvedValueOnce(false)

    await runCommand(['auth', 'logout'])

    expect(mockClearCredentials).not.toHaveBeenCalled()
  })

  it('exits with error when not logged in', async () => {
    mockGetAuthState.mockReturnValueOnce({ source: 'none' })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(runCommand(['auth', 'logout'])).rejects.toThrow()

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Not logged in'))
    expect(mockClearCredentials).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('exits with error when credentials are set via env vars', async () => {
    mockGetAuthState.mockReturnValueOnce({
      source: 'env',
      credentials: { email: 'env@example.com', apiToken: 'env-token' },
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(runCommand(['auth', 'logout'])).rejects.toThrow()

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('BITBUCKET_EMAIL')
    )
    expect(mockClearCredentials).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('clears credentials with --yes without prompting', async () => {
    mockGetAuthState.mockReturnValueOnce({
      source: 'file',
      credentials: { email: 'file@example.com', apiToken: 'file-token' },
    })

    await runCommand(['auth', 'logout', '--yes'])

    expect(mockConfirm).not.toHaveBeenCalled()
    expect(mockClearCredentials).toHaveBeenCalled()
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
