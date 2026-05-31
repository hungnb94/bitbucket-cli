import { Command } from 'commander'
import { declinePullRequest } from '../../api/pr.js'
import { requireAuth, getContext, parseId, runPrAction } from './helpers.js'

export function register(pr: Command): void {
  pr
    .command('decline')
    .description('Decline a pull request')
    .argument('<id>', 'PR ID')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (id, options) => {
      requireAuth()
      const { workspace, repo } = getContext(pr.opts())
      const prId = parseId(id)
      await runPrAction(workspace, repo, prId, {
        confirmVerb: 'Decline',
        actionMsg: 'Declining...',
        successMsg: `PR #${prId} declined`,
        skipConfirm: !!options.yes,
        apiFn: declinePullRequest,
      })
    })
}
