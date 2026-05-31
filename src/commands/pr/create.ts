import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { confirm } from '@inquirer/prompts'
import { createPullRequest } from '../../api/pr.js'
import { getCurrentBranch, detectDefaultTarget } from '../../pr/index.js'
import { requireAuth, getContext } from './helpers.js'

export function register(pr: Command): void {
  pr
    .command('create')
    .description('Create a pull request')
    .requiredOption('--title <title>', 'PR title')
    .option('--description <text>', 'PR description')
    .option('--target <branch>', 'Target branch (default: main or master)')
    .option('--source <branch>', 'Source branch (default: current branch)')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (options) => {
      requireAuth()
      const { workspace, repo } = getContext(pr.opts())

      let sourceBranch: string
      if (options.source !== undefined) {
        sourceBranch = options.source.trim()
        if (!sourceBranch) {
          console.error(chalk.red('✗') + ' --source branch name cannot be empty.')
          process.exit(1)
        }
      } else {
        try {
          sourceBranch = getCurrentBranch()
        } catch (error) {
          console.error(chalk.red('✗') + ' ' + (error instanceof Error ? error.message : String(error)))
          process.exit(1)
        }
      }

      let targetBranch: string
      if (options.target !== undefined) {
        targetBranch = options.target.trim()
        if (!targetBranch) {
          console.error(chalk.red('✗') + ' --target branch name cannot be empty.')
          process.exit(1)
        }
      } else {
        try {
          targetBranch = detectDefaultTarget()
        } catch (error) {
          console.error(chalk.red('✗') + ' ' + (error instanceof Error ? error.message : String(error)))
          process.exit(1)
        }
      }

      if (sourceBranch === targetBranch) {
        console.error(chalk.red('✗') + ' Source and target branch must be different.')
        process.exit(1)
      }

      let spinner: ReturnType<typeof ora> | undefined
      try {
        if (!options.yes) {
          console.log()
          console.log(`  Title:   ${options.title}`)
          console.log(`  Source:  ${sourceBranch} → ${targetBranch}`)
          console.log(`  Desc:    ${options.description ?? '(none)'}`)
          console.log()
          const confirmed = await confirm({
            message: 'Create PR?',
            default: false,
          })
          if (!confirmed) { console.log(chalk.dim('Cancelled.')); return }
        }

        spinner = ora('Creating pull request...').start()
        const result = await createPullRequest(workspace, repo, options.title, sourceBranch, targetBranch, options.description)
        if (!result.id || !result.links?.html?.href) throw new Error('Unexpected response from Bitbucket API.')
        spinner.succeed(`PR #${result.id} created: ${result.links.html.href}`)
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') process.exit(0)
        spinner?.fail(error instanceof Error ? error.message : 'Unknown error')
        process.exit(1)
      }
    })
}
