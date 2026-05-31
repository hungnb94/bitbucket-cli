import { buildClient, withRetry } from './client.js'

export async function getUserByUsername(
  username: string
): Promise<{ uuid: string; displayName: string }> {
  try {
    return await withRetry(async () => {
      const client = buildClient()
      // TODO: /users/{username} is a legacy Bitbucket slug lookup — migrate to
      // workspace members search API (/workspaces/{ws}/members?q=nickname="...") for stability
      const response = await client.get<{ uuid: string; display_name: string }>(
        `/users/${username}`
      )
      return { uuid: response.data.uuid, displayName: response.data.display_name }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Not found.') {
      throw new Error(`Reviewer not found: ${username}`)
    }
    throw error
  }
}
