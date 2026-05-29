import { Command } from 'commander'
import { input, password, confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import ora from 'ora'
import {
  getCredentials,
  saveCredentials,
  clearCredentials,
  validateCredentials,
  getConfigPath,
} from '../auth/index.js'

function printLoginGuide(): void {
  console.log(chalk.blue('ℹ') + '  You need to create an API token on Atlassian before continuing.\n')
  console.log('   Visit: ' + chalk.cyan('https://id.atlassian.com/manage-profile/security/api-tokens'))
  console.log()
  console.log('   Steps to create a token:')
  console.log('     1. Select "Create API token with scopes"')
  console.log('     2. Set a name and expiration date')
  console.log('     3. Select application: Bitbucket')
  console.log('     4. Select scopes as guided below')
  console.log('     5. Copy the token immediately — it is only shown once')
  console.log()
  console.log('   Minimum required scopes:')
  console.log('     ' + chalk.green('✓') + ' User: Read                (to fetch account info)')
  console.log('     ' + chalk.green('✓') + ' Repositories: Read        (to read repos, view diffs)')
  console.log('     ' + chalk.green('✓') + ' Pull requests: Read       (to list/view PRs, post comments)')
  console.log('     ' + chalk.green('✓') + ' Pull requests: Write      (to approve/decline/merge PRs)')
  console.log()
  console.log('   Optional scopes:')
  console.log('     • Repositories: Write       (if you want to create PRs later)')
  console.log('     • Pipelines: Read           (if you want to view CI/CD)')
  console.log()
}

export function createAuthCommand(): Command {
  const auth = new Command('auth').description('Manage Bitbucket authentication')

  auth
    .command('login')
    .description('Log in with your Atlassian API token')
    .action(async () => {
      printLoginGuide()

      const username = await input({ message: 'Bitbucket username:' })
      const apiToken = await password({ message: 'API token:', mask: '*' })
      const defaultWorkspace = await input({ message: 'Default workspace:' })
      const defaultRepoInput = await input({ message: 'Default repo (optional):', default: '' })

      const spinner = ora('Verifying credentials...').start()
      try {
        const userInfo = await validateCredentials({ username, apiToken })
        spinner.succeed(`Verified — welcome ${userInfo.displayName}`)
        saveCredentials({
          username,
          apiToken,
          defaultWorkspace,
          defaultRepo: defaultRepoInput || undefined,
        })
        console.log(chalk.green('✓') + ` Credentials saved to ${getConfigPath()}`)
      } catch (error) {
        spinner.fail(
          'Verification failed — ' + (error instanceof Error ? error.message : 'Unknown error')
        )
        console.log(
          '  Check your username and API token, then run ' +
          chalk.cyan('bitbucket auth login')
        )
        process.exit(1)
      }
    })

  auth
    .command('logout')
    .description('Remove saved credentials')
    .action(async () => {
      const confirmed = await confirm({ message: 'Remove saved credentials?', default: false })
      if (confirmed) {
        clearCredentials()
        console.log(chalk.green('✓') + ` Removed ${getConfigPath()}`)
      }
    })

  auth
    .command('whoami')
    .description('Show current authenticated user')
    .action(async () => {
      const creds = getCredentials()
      if (!creds) {
        console.error(
          chalk.red('✗') + ' Not logged in. Run: ' + chalk.cyan('bitbucket auth login')
        )
        process.exit(1)
      }
      const spinner = ora('Fetching user info...').start()
      try {
        const userInfo = await validateCredentials(creds)
        spinner.stop()
        console.log()
        console.log('  Username:     ' + userInfo.username)
        console.log('  Display name: ' + userInfo.displayName)
        console.log('  Account ID:   ' + userInfo.accountId)
      } catch (error) {
        spinner.fail(
          'Failed to fetch user info: ' + (error instanceof Error ? error.message : 'Unknown error')
        )
        process.exit(1)
      }
    })

  return auth
}
