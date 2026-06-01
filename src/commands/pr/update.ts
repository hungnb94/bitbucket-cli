import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { confirm } from '@inquirer/prompts'
import { getPullRequest, updatePullRequest } from '../../api/pr.js'
import { diffFields, type UpdateInput } from '../../pr/update.js'
import { requireAuth, getContext, parseId } from './helpers.js'

const truncate = (s: string, max = 80) => (s.length > max ? s.slice(0, max) + '…' : s)

interface UpdateOptions {
  title?: string
  description?: string
  yes?: boolean
}

export function register(pr: Command): void {
  pr
    .command('update')
    .description('Update a pull request')
    .argument('<id>', 'PR ID')
    .option('--title <text>', 'Update PR title')
    .option('--description <text>', 'Update PR description')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (id, options: UpdateOptions) => {
      requireAuth()
      const { workspace, repo } = getContext(pr.opts())
      const prId = parseId(id)

      if (options.title !== undefined && options.title.trim() === '') {
        console.error(chalk.red('✗') + ' --title cannot be empty.')
        process.exit(1)
      }

      const hasFlags = options.title !== undefined || options.description !== undefined

      let fetchSpinner: ReturnType<typeof ora> | undefined
      let actionSpinner: ReturnType<typeof ora> | undefined

      try {
        fetchSpinner = ora('Fetching pull request...').start()
        const current = await getPullRequest(workspace, repo, prId)
        fetchSpinner.stop()

        if (!hasFlags) {
          console.log()
          console.log(`  Title:       ${current.title}`)
          console.log(`  Description: ${current.description || '(none)'}`)
          console.log()
          console.log(chalk.dim('Run with flags to update, e.g.:'))
          console.log(chalk.dim('  --title "New title"'))
          console.log(chalk.dim('  --description "New description"'))
          return
        }

        const input: UpdateInput = {
          title: options.title?.trim(),
          description: options.description?.trim(),
        }

        const patch = diffFields(current, input)

        if (Object.keys(patch).length === 0) {
          console.log('Nothing to update.')
          return
        }

        // Bitbucket PUT requires title even when not changing it
        if (!patch.title) patch.title = current.title

        if (!options.yes) {
          console.log()
          if (options.title !== undefined) {
            console.log(`  Title:       ${chalk.dim(current.title)} → ${patch.title}`)
          }
          if (patch.description !== undefined) {
            console.log(
              `  Description: ${chalk.dim(truncate(current.description || '(none)'))} → ${truncate(patch.description || '(none)')}`
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
