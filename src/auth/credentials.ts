import axios from 'axios'

export type UserInfo = {
  username: string
  displayName: string
  accountId: string
}

type BitbucketUserResponse = {
  username: string
  display_name: string
  account_id: string
}

async function fetchUser(apiToken: string): Promise<BitbucketUserResponse> {
  const response = await axios.get<BitbucketUserResponse>(
    'https://api.bitbucket.org/2.0/user',
    {
      headers: { Authorization: `Bearer ${apiToken}` },
      timeout: 10000,
    }
  )
  return response.data
}

function toUserInfo(data: BitbucketUserResponse): UserInfo {
  return {
    username: data.username,
    displayName: data.display_name,
    accountId: data.account_id,
  }
}

export async function validateCredentials(creds: {
  username: string
  apiToken: string
}): Promise<UserInfo> {
  try {
    return toUserInfo(await fetchUser(creds.apiToken))
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error

    if (error.response?.status === 401) throw new Error('401 Unauthorized')
    if (error.response?.status === 403) {
      throw new Error('403 Forbidden: token thiếu quyền, kiểm tra lại scopes')
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      try {
        return toUserInfo(await fetchUser(creds.apiToken))
      } catch {
        throw new Error('Kết nối thất bại sau khi thử lại. Kiểm tra kết nối mạng.')
      }
    }
    throw new Error(error.message)
  }
}
