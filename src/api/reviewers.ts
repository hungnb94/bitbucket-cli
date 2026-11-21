import type { ReviewerRef } from '../pr/reviewers.js'
import { buildClient, withRetry } from './client.js'
import { toReviewerRef, type BitbucketUser } from './users.js'

type DefaultReviewersPage = {
  values: Array<{ user: BitbucketUser }>
  next?: string
}

const MAX_PAGES = 10

export async function getDefaultReviewers(workspace: string, repo: string): Promise<ReviewerRef[]> {
  return withRetry(async () => {
    const client = buildClient()
    const reviewers: ReviewerRef[] = []
    let response = await client.get<DefaultReviewersPage>(
      `/repositories/${workspace}/${repo}/effective-default-reviewers`,
      { params: { pagelen: 100 } }
    )
    for (let page = 1; ; page++) {
      reviewers.push(...response.data.values.map((entry) => toReviewerRef(entry.user)))
      if (!response.data.next) return reviewers
      if (page >= MAX_PAGES) throw new Error('Too many pages of default reviewers.')
      response = await client.get<DefaultReviewersPage>(response.data.next)
    }
  })
}

export function toReviewerPayload(reviewers: ReviewerRef[]): Array<{ uuid: string } | { account_id: string }> {
  return reviewers.map((r) => (r.uuid ? { uuid: r.uuid } : { account_id: r.account_id! }))
}
