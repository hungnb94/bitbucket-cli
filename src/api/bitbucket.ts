import axios, { type AxiosInstance } from 'axios'
import { getCredentials } from '../auth/index.js'

const BASE_URL = 'https://api.bitbucket.org/2.0'

export function createClient(): AxiosInstance {
  const creds = getCredentials()
  if (!creds) {
    throw new Error('Chưa có credentials. Chạy: bitbucket auth login')
  }
  return axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${creds.apiToken}` },
    timeout: 15000,
  })
}
