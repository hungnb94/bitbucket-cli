import { confirm } from '@inquirer/prompts'

export async function resolveConfirm(yes: boolean, message: string): Promise<boolean> {
  if (yes) return true
  return confirm({ message, default: false })
}
