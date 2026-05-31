import { buildClient, withRetry } from './client.js'

export async function getUserByUsername(
  workspace: string,
  username: string
): Promise<{ uuid: string; displayName: string }> {
  return await withRetry(async () => {
    const client = buildClient()
    const response = await client.get<{
      values: { user: { uuid: string; display_name: string } }[]
    }>(`/workspaces/${workspace}/members`, { params: { q: `nickname="${username}"` } })
    const member = response.data.values[0]
    if (!member) throw new Error(`Reviewer not found: ${username}`)
    return { uuid: member.user.uuid, displayName: member.user.display_name }
  })
}
