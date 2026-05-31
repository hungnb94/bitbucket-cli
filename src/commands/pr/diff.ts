import { Command } from 'commander'
import ora from 'ora'
import { getPullRequestDiff } from '../../api/pr.js'
import { formatDiff } from '../../pr/index.js'
import { requireAuth, getContext, parseId } from './helpers.js'

export function register(pr: Command): void {
  pr
    .command('diff')
    .description('Show diff for a pull request')
    .argument('<id>', 'PR ID')
    .action(async (id) => {
      requireAuth()
      const { workspace, repo } = getContext(pr.opts())
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
}
