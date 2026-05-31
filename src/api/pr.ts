import axios from 'axios'
import type { PullRequest, DiffStat } from '../pr/types.js'
import { buildClient, withRetry } from './client.js'

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
    if (description !== undefined) body.description = description
    try {
      const response = await client.post<{ id: number; links: { html: { href: string } } }>(
        `/repositories/${workspace}/${repo}/pullrequests`,
        body
      )
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        throw new Error('A PR already exists for this branch.')
      }
      throw error
    }
  })
}
