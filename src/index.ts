import { Command } from 'commander'
import { createAuthCommand } from './commands/auth.js'
import { createPrCommand } from './commands/pr/index.js'

import packageJson from '../package.json'

const program = new Command()

program
  .name('bitbucket')
  .description('Bitbucket CLI tool')
  .version(packageJson.version)

program.addCommand(createAuthCommand())
program.addCommand(createPrCommand())

program.parse()
