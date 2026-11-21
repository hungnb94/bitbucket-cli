import type { ReviewerRef } from '../pr/reviewers.js'
import { buildClient, withRetry } from './client.js'

export type BitbucketUser = {
  uuid: string
  account_id?: string
  display_name: string
}

export function toReviewerRef(user: BitbucketUser): ReviewerRef {
  return { uuid: user.uuid, account_id: user.account_id, displayName: user.display_name }
}

export async function getCurrentUser(): Promise<ReviewerRef> {
  return withRetry(async () => {
    const response = await buildClient().get<BitbucketUser>('/user')
    return toReviewerRef(response.data)
  })
}
