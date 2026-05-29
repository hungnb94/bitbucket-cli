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
  console.log(chalk.blue('ℹ') + '  Bạn cần tạo API token trên Atlassian trước khi tiếp tục.\n')
  console.log('   Truy cập: ' + chalk.cyan('https://id.atlassian.com/manage-profile/security/api-tokens'))
  console.log()
  console.log('   Bước tạo token:')
  console.log('     1. Chọn "Create API token with scopes"')
  console.log('     2. Đặt tên và ngày hết hạn')
  console.log('     3. Chọn ứng dụng: Bitbucket')
  console.log('     4. Chọn scopes theo hướng dẫn bên dưới')
  console.log('     5. Sao chép token ngay — token chỉ hiển thị một lần')
  console.log()
  console.log('   Scopes tối thiểu cần cấp:')
  console.log('     ' + chalk.green('✓') + ' User: Read                (để lấy thông tin tài khoản)')
  console.log('     ' + chalk.green('✓') + ' Repositories: Read        (để đọc repo, xem diff)')
  console.log('     ' + chalk.green('✓') + ' Pull requests: Read       (để list/view PR, comment)')
  console.log('     ' + chalk.green('✓') + ' Pull requests: Write      (để approve/decline/merge PR)')
  console.log()
  console.log('   Scopes tuỳ chọn:')
  console.log('     • Repositories: Write       (nếu muốn tạo PR sau này)')
  console.log('     • Pipelines: Read           (nếu muốn xem CI/CD)')
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

      const spinner = ora('Đang xác minh credentials...').start()
      try {
        const userInfo = await validateCredentials({ username, apiToken })
        spinner.succeed(`Xác minh thành công — chào ${userInfo.displayName}`)
        saveCredentials({
          username,
          apiToken,
          defaultWorkspace,
          defaultRepo: defaultRepoInput || undefined,
        })
        console.log(chalk.green('✓') + ` Credentials đã lưu vào ${getConfigPath()}`)
      } catch (error) {
        spinner.fail(
          'Xác minh thất bại — ' + (error instanceof Error ? error.message : 'Unknown error')
        )
        console.log(
          '  Kiểm tra lại username và API token, sau đó chạy lại ' +
          chalk.cyan('bitbucket auth login')
        )
        process.exit(1)
      }
    })

  auth
    .command('logout')
    .description('Remove saved credentials')
    .action(async () => {
      const confirmed = await confirm({ message: 'Xoá credentials đã lưu?', default: false })
      if (confirmed) {
        clearCredentials()
        console.log(chalk.green('✓') + ` Đã xoá ${getConfigPath()}`)
      }
    })

  auth
    .command('whoami')
    .description('Show current authenticated user')
    .action(async () => {
      const creds = getCredentials()
      if (!creds) {
        console.error(
          chalk.red('✗') + ' Chưa có credentials. Chạy: ' + chalk.cyan('bitbucket auth login')
        )
        process.exit(1)
      }
      const spinner = ora('Đang lấy thông tin...').start()
      try {
        const userInfo = await validateCredentials(creds)
        spinner.stop()
        console.log()
        console.log('  Username:     ' + userInfo.username)
        console.log('  Display name: ' + userInfo.displayName)
        console.log('  Account ID:   ' + userInfo.accountId)
      } catch (error) {
        spinner.fail(
          'Không thể lấy thông tin: ' + (error instanceof Error ? error.message : 'Unknown error')
        )
        process.exit(1)
      }
    })

  return auth
}
