import { Command, Option } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { listPullRequests } from '../../api/pr.js'
import { formatPrList } from '../../pr/index.js'
import { requireAuth, getContext } from './helpers.js'

export function register(pr: Command): void {
  pr
    .command('list')
    .description('List pull requests')
    .addOption(
      new Option('--state <state>', 'Filter by state').choices(['open', 'merged', 'declined', 'all']).default('open')
    )
    .option('--limit <n>', 'Number of PRs to show', '20')
    .action(async (options) => {
      requireAuth()
      const { workspace, repo } = getContext(pr.opts())
      const limit = parseInt(options.limit, 10)
      if (isNaN(limit) || limit < 1) {
        console.error(chalk.red('✗') + ' --limit must be a positive integer')
        process.exit(1)
      }
      const spinner = ora('Fetching pull requests...').start()
      try {
        const prs = await listPullRequests(workspace, repo, options.state, limit)
        spinner.stop()
        console.log(formatPrList(prs))
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Unknown error')
        process.exit(1)
      }
    })
}
