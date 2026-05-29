import { Command } from 'commander'
import { createAuthCommand } from './commands/auth.js'

const program = new Command()

program
  .name('bitbucket')
  .description('Bitbucket CLI tool')
  .version('0.1.0')

program.addCommand(createAuthCommand())

program.parse()
