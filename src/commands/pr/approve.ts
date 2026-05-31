import { Command } from 'commander'
import { approvePullRequest } from '../../api/pr.js'
import { requireAuth, getContext, parseId, runPrAction } from './helpers.js'

export function register(pr: Command): void {
  pr
    .command('approve')
    .description('Approve a pull request')
    .argument('<id>', 'PR ID')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (id, options) => {
      requireAuth()
      const { workspace, repo } = getContext(pr.opts())
      const prId = parseId(id)
      await runPrAction(workspace, repo, prId, {
        confirmVerb: 'Approve',
        actionMsg: 'Approving...',
        successMsg: `PR #${prId} approved`,
        skipConfirm: !!options.yes,
        apiFn: approvePullRequest,
      })
    })
}
