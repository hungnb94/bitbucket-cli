import axios, { type AxiosInstance, type AxiosError } from 'axios'
import { getCredentials, buildBasicAuth } from '../auth/index.js'

const BASE_URL = 'https://api.bitbucket.org/2.0'

export function buildClient(): AxiosInstance {
  const creds = getCredentials()
  const headers: Record<string, string> = {}
  if (creds) {
    headers.Authorization = buildBasicAuth(creds.email, creds.apiToken)
  }
  return axios.create({
    baseURL: BASE_URL,
    headers,
    timeout: 15000,
  })
}

function throwApiError(error: AxiosError, prId?: number): never {
  if (error.response?.status === 401) throw new Error('401 Unauthorized')
  if (error.response?.status === 403) {
    throw new Error('403 Forbidden: token missing required scopes.')
  }
  if (error.response?.status === 404) {
    throw new Error(prId !== undefined ? `PR #${prId} not found.` : 'Not found.')
  }
  if (error.response) throw new Error(`Request failed with status ${error.response.status}`)
  throw new Error('Connection failed. Check your network connection.')
}

function throwRetryError(error: AxiosError, prId?: number): never {
  if (error.response) return throwApiError(error, prId)
  throw new Error('Connection failed after retry.')
}

export async function withRetry<T>(fn: () => Promise<T>, prId?: number): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
    ) {
      try {
        return await fn()
      } catch (retryError) {
        if (axios.isAxiosError(retryError)) throwRetryError(retryError, prId)
        throw retryError
      }
    }
    if (axios.isAxiosError(error)) throwApiError(error, prId)
    throw error
  }
}
