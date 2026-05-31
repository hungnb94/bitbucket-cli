import axios from 'axios'
import { buildClient, withRetry } from './client.js'

export async function getUserByUsername(
  username: string
): Promise<{ uuid: string; displayName: string }> {
  return withRetry(async () => {
    const client = buildClient()
    try {
      const response = await client.get<{ uuid: string; display_name: string }>(
        `/users/${username}`
      )
      return { uuid: response.data.uuid, displayName: response.data.display_name }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error(`Reviewer not found: ${username}`)
      }
      throw error
    }
  })
}
