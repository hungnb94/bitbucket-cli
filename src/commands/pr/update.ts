import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { confirm } from '@inquirer/prompts'
import { getPullRequest, updatePullRequest } from '../../api/pr.js'
import { buildReviewerPatch, diffFields, type UpdateInput } from '../../pr/update.js'
import { requireAuth, getContext, parseId } from './helpers.js'

interface UpdateOptions {
  title?: string
  description?: string
  target?: string
  addReviewer: string[]
  removeReviewer: string[]
  closeSourceBranch?: boolean
  yes?: boolean
}

export function register(pr: Command): void {
  pr
    .command('update')
    .description('Update a pull request')
    .argument('<id>', 'PR ID')
    .option('--title <text>', 'Update PR title')
    .option('--description <text>', 'Update PR description')
    .option('--target <branch>', 'Update destination branch')
    .option(
      '--add-reviewer <username>',
      'Add a reviewer (repeatable)',
      (v, a: string[]) => [...a, v],
      [] as string[]
    )
    .option(
      '--remove-reviewer <username>',
      'Remove a reviewer (repeatable)',
      (v, a: string[]) => [...a, v],
      [] as string[]
    )
    .option('--close-source-branch', 'Enable close-source-branch on merge')
    .option('--no-close-source-branch', 'Disable close-source-branch on merge')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (id, options: UpdateOptions) => {
      requireAuth()
      const { workspace, repo } = getContext(pr.opts())
      const prId = parseId(id)

      if (options.title !== undefined && options.title.trim() === '') {
        console.error(chalk.red('✗') + ' --title cannot be empty.')
        process.exit(1)
      }
      if (options.target !== undefined && options.target.trim() === '') {
        console.error(chalk.red('✗') + ' --target cannot be empty.')
        process.exit(1)
      }

      const hasFlags =
        options.title !== undefined ||
        options.description !== undefined ||
        options.target !== undefined ||
        options.addReviewer.length > 0 ||
        options.removeReviewer.length > 0 ||
        options.closeSourceBranch !== undefined

      let fetchSpinner: ReturnType<typeof ora> | undefined
      let actionSpinner: ReturnType<typeof ora> | undefined

      try {
        fetchSpinner = ora('Fetching pull request...').start()
        const current = await getPullRequest(workspace, repo, prId)
        fetchSpinner.stop()

        if (!hasFlags) {
          console.log()
          console.log(`  Title:               ${current.title}`)
          console.log(`  Description:         ${current.description || '(none)'}`)
          console.log(`  Target:              ${current.destBranch}`)
          console.log(
            `  Reviewers:           ${current.reviewerNames.length > 0 ? current.reviewerNames.join(', ') : '(none)'}`
          )
          console.log(`  Close source branch: ${current.closeSourceBranch ? 'yes' : 'no'}`)
          console.log()
          console.log(chalk.dim('Run with flags to update, e.g.:'))
          console.log(chalk.dim('  --title "New title"'))
          console.log(chalk.dim('  --add-reviewer <username>'))
          console.log(chalk.dim('  --remove-reviewer <username>'))
          console.log(chalk.dim('  --target <branch>'))
          console.log(chalk.dim('  --close-source-branch / --no-close-source-branch'))
          return
        }

        const input: UpdateInput = {
          title: options.title?.trim(),
          description: options.description,
          target: options.target?.trim(),
          addReviewers: options.addReviewer,
          removeReviewers: options.removeReviewer,
          closeSourceBranch: options.closeSourceBranch,
        }

        const newReviewers = await buildReviewerPatch(
          current.reviewerUuids,
          input.addReviewers ?? [],
          input.removeReviewers ?? []
        )
        const patch = diffFields(current, input, newReviewers)

        if (Object.keys(patch).length === 0) {
          console.log('Nothing to update.')
          return
        }

        if (!options.yes) {
          console.log()
          if (patch.title !== undefined) {
            console.log(`  Title:   ${chalk.dim(current.title)} → ${patch.title}`)
          }
          if (patch.description !== undefined) {
            console.log(
              `  Description: ${chalk.dim(current.description || '(none)')} → ${patch.description || '(none)'}`
            )
          }
          if (patch.destination !== undefined) {
            console.log(
              `  Target:  ${chalk.dim(current.destBranch)} → ${patch.destination.branch.name}`
            )
          }
          if (patch.reviewers !== undefined) {
            const adds = input.addReviewers ?? []
            const removes = input.removeReviewers ?? []
            const parts: string[] = []
            if (adds.length > 0) parts.push(adds.map((n) => `+${n}`).join(', '))
            if (removes.length > 0) parts.push(removes.map((n) => `-${n}`).join(', '))
            console.log(`  Reviewers: ${parts.join('  ')}`)
          }
          if (patch.closeSourceBranch !== undefined) {
            console.log(
              `  Close source branch: ${chalk.dim(current.closeSourceBranch ? 'yes' : 'no')} → ${patch.closeSourceBranch ? 'yes' : 'no'}`
            )
          }
          console.log()
          const confirmed = await confirm({ message: `Update PR #${prId}?`, default: false })
          if (!confirmed) {
            console.log(chalk.dim('Cancelled.'))
            return
          }
        }

        actionSpinner = ora('Updating pull request...').start()
        const result = await updatePullRequest(workspace, repo, prId, patch)
        actionSpinner.succeed(`PR #${prId} updated: ${result.links.html.href}`)
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') process.exit(0)
        ;(actionSpinner ?? fetchSpinner)?.fail(
          error instanceof Error ? error.message : 'Unknown error'
        )
        process.exit(1)
      }
    })
}
