import axios, { type AxiosInstance, type AxiosError } from 'axios'
import { getCredentials, buildBasicAuth } from '../auth/index.js'
import type { PullRequest, DiffStat } from '../pr/types.js'

const BASE_URL = 'https://api.bitbucket.org/2.0'

function buildClient(): AxiosInstance {
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

// --- Internal types ---

type BitbucketPRResponse = {
  id: number
  title: string
  author: { display_name: string }
  state: string
  updated_on: string
  description: string
  reviewers: Array<{ display_name: string }>
  source: { branch: { name: string } }
  destination: { branch: { name: string } }
}

type BitbucketDiffstatEntry = {
  lines_added: number
  lines_removed: number
}

// --- Helpers ---

function throwApiError(error: AxiosError, prId?: number): never {
  if (error.response?.status === 401) throw new Error('401 Unauthorized')
  if (error.response?.status === 403) {
    throw new Error('403 Forbidden: token missing required scopes.')
  }
  if (error.response?.status === 404) {
    throw new Error(prId !== undefined ? `PR #${prId} not found.` : 'Not found.')
  }
  if (error.response?.status === 409) {
    throw new Error('A PR already exists for this branch.')
  }
  if (error.response) throw new Error(`Request failed with status ${error.response.status}`)
  throw new Error('Connection failed. Check your network connection.')
}

function throwRetryError(error: AxiosError, prId?: number): never {
  if (error.response) return throwApiError(error, prId)
  throw new Error('Connection failed after retry.')
}

async function withRetry<T>(fn: () => Promise<T>, prId?: number): Promise<T> {
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

function toPullRequest(data: BitbucketPRResponse): PullRequest {
  return {
    id: data.id,
    title: data.title,
    authorName: data.author.display_name,
    state: data.state as PullRequest['state'],
    updatedOn: data.updated_on,
    description: data.description ?? '',
    reviewerNames: (data.reviewers ?? []).map((r) => r.display_name),
    sourceBranch: data.source.branch.name,
    destBranch: data.destination.branch.name,
  }
}

// --- PR API ---

export async function listPullRequests(
  workspace: string,
  repo: string,
  state: string,
  limit: number
): Promise<PullRequest[]> {
  return withRetry(async () => {
    const client = buildClient()
    const params: Record<string, string | number> =
      state === 'all'
        ? { pagelen: limit, q: 'state IN ("OPEN", "MERGED", "DECLINED", "SUPERSEDED")' }
        : { pagelen: limit, state: state.toUpperCase() }
    const response = await client.get<{ values: BitbucketPRResponse[] }>(
      `/repositories/${workspace}/${repo}/pullrequests`,
      { params }
    )
    return response.data.values.map(toPullRequest)
  })
}

export async function getPullRequest(
  workspace: string,
  repo: string,
  id: number
): Promise<PullRequest> {
  return withRetry(async () => {
    const client = buildClient()
    const response = await client.get<BitbucketPRResponse>(
      `/repositories/${workspace}/${repo}/pullrequests/${id}`
    )
    return toPullRequest(response.data)
  }, id)
}

export async function getPullRequestDiffStat(
  workspace: string,
  repo: string,
  id: number
): Promise<DiffStat> {
  return withRetry(async () => {
    const client = buildClient()
    const response = await client.get<{ values: BitbucketDiffstatEntry[] }>(
      `/repositories/${workspace}/${repo}/pullrequests/${id}/diffstat`,
      { params: { pagelen: 2000 } }
    )
    const values = response.data.values
    return {
      additions: values.reduce((sum, v) => sum + v.lines_added, 0),
      deletions: values.reduce((sum, v) => sum + v.lines_removed, 0),
      filesChanged: values.length,
    }
  }, id)
}

export async function getPullRequestDiff(
  workspace: string,
  repo: string,
  id: number
): Promise<string> {
  return withRetry(async () => {
    const client = buildClient()
    const response = await client.get<string>(
      `/repositories/${workspace}/${repo}/pullrequests/${id}/diff`,
      { responseType: 'text' }
    )
    return response.data
  }, id)
}

export async function approvePullRequest(
  workspace: string,
  repo: string,
  id: number
): Promise<void> {
  return withRetry(async () => {
    const client = buildClient()
    await client.post(`/repositories/${workspace}/${repo}/pullrequests/${id}/approve`)
  }, id)
}

export async function declinePullRequest(
  workspace: string,
  repo: string,
  id: number
): Promise<void> {
  return withRetry(async () => {
    const client = buildClient()
    await client.post(`/repositories/${workspace}/${repo}/pullrequests/${id}/decline`)
  }, id)
}

export async function postComment(
  workspace: string,
  repo: string,
  id: number,
  message: string,
  inline?: { path: string; line: number }
): Promise<void> {
  return withRetry(async () => {
    const client = buildClient()
    const body: Record<string, unknown> = { content: { raw: message } }
    if (inline) body.inline = { path: inline.path, to: inline.line }
    await client.post(`/repositories/${workspace}/${repo}/pullrequests/${id}/comments`, body)
  }, id)
}

export async function createPullRequest(
  workspace: string,
  repo: string,
  title: string,
  sourceBranch: string,
  targetBranch: string,
  description?: string
): Promise<{ id: number; links: { html: { href: string } } }> {
  return withRetry(async () => {
    const client = buildClient()
    const body: Record<string, unknown> = {
      title,
      source: { branch: { name: sourceBranch } },
      destination: { branch: { name: targetBranch } },
    }
    if (description) body.description = description
    const response = await client.post<{ id: number; links: { html: { href: string } } }>(
      `/repositories/${workspace}/${repo}/pullrequests`,
      body
    )
    return response.data
  })
}
