import { Command } from 'commander'
import ora from 'ora'
import { getPullRequest, getPullRequestDiffStat } from '../../api/pr.js'
import { formatPrView } from '../../pr/index.js'
import { requireAuth, getContext, parseId } from './helpers.js'

export function register(pr: Command): void {
  pr
    .command('view')
    .description('View a pull request')
    .argument('<id>', 'PR ID')
    .action(async (id) => {
      requireAuth()
      const { workspace, repo } = getContext(pr.opts())
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
}
