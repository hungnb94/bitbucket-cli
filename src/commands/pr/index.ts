import { Command } from 'commander'
import { register as registerList } from './list.js'
import { register as registerView } from './view.js'
import { register as registerDiff } from './diff.js'
import { register as registerApprove } from './approve.js'
import { register as registerDecline } from './decline.js'
import { register as registerComment } from './comment.js'
import { register as registerCreate } from './create.js'
import { register as registerUpdate } from './update.js'

export function createPrCommand(): Command {
  const pr = new Command('pr')
    .description('Manage pull requests')
    .option('--workspace <workspace>', 'Bitbucket workspace')
    .option('--repo <repo>', 'Bitbucket repository slug')

  registerList(pr)
  registerView(pr)
  registerDiff(pr)
  registerApprove(pr)
  registerDecline(pr)
  registerComment(pr)
  registerCreate(pr)
  registerUpdate(pr)

  return pr
}
