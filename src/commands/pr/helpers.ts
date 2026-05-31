import chalk from 'chalk'
import ora from 'ora'
import { confirm } from '@inquirer/prompts'
import { getCredentials } from '../../auth/index.js'
import { getRepoContext, type RepoContext } from '../../pr/index.js'
import { getPullRequest } from '../../api/pr.js'

export function requireAuth(): void {
  if (!getCredentials()) {
    console.error(chalk.red('✗') + ' Not logged in. Run: ' + chalk.cyan('bitbucket auth login'))
    process.exit(1)
  }
}

export function getContext(flags?: { workspace?: string; repo?: string }): RepoContext {
  if (flags?.workspace !== undefined && flags.workspace.trim() === '') {
    console.error(chalk.red('✗') + ' --workspace cannot be empty.')
    process.exit(1)
  }
  if (flags?.repo !== undefined && flags.repo.trim() === '') {
    console.error(chalk.red('✗') + ' --repo cannot be empty.')
    process.exit(1)
  }
  try {
    if (flags?.workspace && flags?.repo) {
      return { workspace: flags.workspace.trim(), repo: flags.repo.trim() }
    }
    const inferred = getRepoContext()
    return {
      workspace: flags?.workspace?.trim() ?? inferred.workspace,
      repo:      flags?.repo?.trim()      ?? inferred.repo,
    }
  } catch (error) {
    console.error(chalk.red('✗') + ' ' + (error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }
}

export function parseId(raw: string): number {
  const id = parseInt(raw, 10)
  if (isNaN(id)) {
    console.error(chalk.red('✗') + ` Invalid PR ID: ${raw}`)
    process.exit(1)
  }
  return id
}

export async function runPrAction(
  workspace: string,
  repo: string,
  prId: number,
  opts: {
    confirmVerb: string
    actionMsg: string
    successMsg: string
    skipConfirm: boolean
    apiFn: (ws: string, repo: string, id: number) => Promise<void>
  }
): Promise<void> {
  let fetchSpinner: ReturnType<typeof ora> | undefined
  let actionSpinner: ReturnType<typeof ora> | undefined
  try {
    if (!opts.skipConfirm) {
      fetchSpinner = ora('Fetching pull request...').start()
      const pullRequest = await getPullRequest(workspace, repo, prId)
      fetchSpinner.stop()
      const confirmed = await confirm({
        message: `${opts.confirmVerb} PR #${prId} "${pullRequest.title}"?`,
        default: false,
      })
      if (!confirmed) { console.log(chalk.dim('Cancelled.')); return }
    }
    actionSpinner = ora(opts.actionMsg).start()
    await opts.apiFn(workspace, repo, prId)
    actionSpinner.succeed(opts.successMsg)
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') process.exit(0)
    ;(actionSpinner ?? fetchSpinner)?.fail(error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  }
}
