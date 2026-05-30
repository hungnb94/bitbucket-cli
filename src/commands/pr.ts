import { Command } from 'commander'
import { confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import ora from 'ora'
import { getRepoContext, formatPrList, formatPrView, formatDiff } from '../pr/index.js'
import {
  listPullRequests,
  getPullRequest,
  getPullRequestDiffStat,
  getPullRequestDiff,
  approvePullRequest,
  declinePullRequest,
  postComment,
} from '../api/bitbucket.js'
import { getCredentials } from '../auth/index.js'

function requireAuth(): void {
  if (!getCredentials()) {
    console.error(chalk.red('✗') + ' Not logged in. Run: ' + chalk.cyan('bitbucket auth login'))
    process.exit(1)
  }
}

function getContext(): { workspace: string; repo: string } {
  try {
    return getRepoContext()
  } catch (error) {
    console.error(chalk.red('✗') + ' ' + (error instanceof Error ? error.message : String(error)))
    process.exit(1) as never
  }
}

function parseId(raw: string): number {
  const id = parseInt(raw, 10)
  if (isNaN(id)) {
    console.error(chalk.red('✗') + ` Invalid PR ID: ${raw}`)
    process.exit(1)
  }
  return id
}

export function createPrCommand(): Command {
  const pr = new Command('pr').description('Manage pull requests')

  pr
    .command('list')
    .description('List pull requests')
    .option('--state <state>', 'Filter by state: open, merged, declined, all', 'open')
    .option('--limit <n>', 'Number of PRs to show', '20')
    .action(async (options) => {
      requireAuth()
      const { workspace, repo } = getContext()
      const spinner = ora('Fetching pull requests...').start()
      try {
        const prs = await listPullRequests(workspace, repo, options.state, parseInt(options.limit, 10))
        spinner.stop()
        console.log(formatPrList(prs))
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Unknown error')
        process.exit(1)
      }
    })

  pr
    .command('view')
    .description('View a pull request')
    .argument('<id>', 'PR ID')
    .action(async (id) => {
      requireAuth()
      const { workspace, repo } = getContext()
      const prId = parseId(id)
      const spinner = ora('Fetching pull request...').start()
      try {
        const [pullRequest, diffStat] = await Promise.all([
          getPullRequest(workspace, repo, prId),
          getPullRequestDiffStat(workspace, repo, prId),
        ])
        spinner.stop()
        console.log(formatPrView(pullRequest, diffStat))
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Unknown error')
        process.exit(1)
      }
    })

  pr
    .command('diff')
    .description('Show diff for a pull request')
    .argument('<id>', 'PR ID')
    .action(async (id) => {
      requireAuth()
      const { workspace, repo } = getContext()
      const prId = parseId(id)
      const spinner = ora('Fetching diff...').start()
      try {
        const diff = await getPullRequestDiff(workspace, repo, prId)
        spinner.stop()
        console.log(formatDiff(diff))
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Unknown error')
        process.exit(1)
      }
    })

  pr
    .command('approve')
    .description('Approve a pull request')
    .argument('<id>', 'PR ID')
    .action(async (id) => {
      requireAuth()
      const { workspace, repo } = getContext()
      const prId = parseId(id)
      const spinner = ora('Fetching pull request...').start()
      try {
        const pullRequest = await getPullRequest(workspace, repo, prId)
        spinner.stop()
        const confirmed = await confirm({
          message: `Approve PR #${prId} "${pullRequest.title}"?`,
          default: false,
        })
        if (!confirmed) return
        const approveSpinner = ora('Approving...').start()
        await approvePullRequest(workspace, repo, prId)
        approveSpinner.succeed(`PR #${prId} approved`)
      } catch (error) {
        console.error(chalk.red('✗') + ' ' + (error instanceof Error ? error.message : 'Unknown error'))
        process.exit(1)
      }
    })

  pr
    .command('decline')
    .description('Decline a pull request')
    .argument('<id>', 'PR ID')
    .action(async (id) => {
      requireAuth()
      const { workspace, repo } = getContext()
      const prId = parseId(id)
      const spinner = ora('Fetching pull request...').start()
      try {
        const pullRequest = await getPullRequest(workspace, repo, prId)
        spinner.stop()
        const confirmed = await confirm({
          message: `Decline PR #${prId} "${pullRequest.title}"?`,
          default: false,
        })
        if (!confirmed) return
        const declineSpinner = ora('Declining...').start()
        await declinePullRequest(workspace, repo, prId)
        declineSpinner.succeed(`PR #${prId} declined`)
      } catch (error) {
        console.error(chalk.red('✗') + ' ' + (error instanceof Error ? error.message : 'Unknown error'))
        process.exit(1)
      }
    })

  pr
    .command('comment')
    .description('Post a comment on a pull request')
    .argument('<id>', 'PR ID')
    .argument('<message>', 'Comment message')
    .option('--file <path>', 'File path for inline comment')
    .option('--line <n>', 'Line number for inline comment')
    .action(async (id, message, options) => {
      requireAuth()

      if ((options.file && !options.line) || (!options.file && options.line)) {
        console.error(chalk.red('✗') + ' --file and --line must be used together.')
        process.exit(1)
      }

      const { workspace, repo } = getContext()
      const prId = parseId(id)
      const inline =
        options.file && options.line
          ? { path: options.file, line: parseInt(options.line, 10) }
          : undefined

      const spinner = ora('Posting comment...').start()
      try {
        await postComment(workspace, repo, prId, message, inline)
        if (inline) {
          spinner.succeed(`Inline comment posted on ${inline.path}:${inline.line}`)
        } else {
          spinner.succeed(`Comment posted on PR #${prId}`)
        }
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Unknown error')
        process.exit(1)
      }
    })

  return pr
}
