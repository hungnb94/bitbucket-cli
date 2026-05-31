import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { postComment } from '../../api/pr.js'
import { requireAuth, getContext, parseId } from './helpers.js'

export function register(pr: Command): void {
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

      const { workspace, repo } = getContext(pr.opts())
      const prId = parseId(id)
      let lineNum: number | undefined
      if (options.line !== undefined) {
        lineNum = parseInt(options.line, 10)
        if (isNaN(lineNum) || lineNum < 1) {
          console.error(chalk.red('✗') + ' --line must be a positive integer.')
          process.exit(1)
        }
      }
      const inline =
        options.file && lineNum !== undefined
          ? { path: options.file, line: lineNum }
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
}
