import { Command } from 'commander'
import { createAuthCommand } from './commands/auth.js'
import { createPrCommand } from './commands/pr.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json')

const program = new Command()

program
  .name('bitbucket')
  .description('Bitbucket CLI tool')
  .version(packageJson.version)

program.addCommand(createAuthCommand())
program.addCommand(createPrCommand())

program.parse()
