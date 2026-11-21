import { mergeReviewers, parseReviewerId, type ReviewerRef } from './reviewers.js'

export interface ReviewerPort {
  getDefaultReviewers(workspace: string, repo: string): Promise<ReviewerRef[]>
  getCurrentUser(): Promise<ReviewerRef>
}

export type ReviewerRequest = {
  explicit: string[]
  useDefaults: boolean
  current?: ReviewerRef[]
  author?: ReviewerRef
}

export class ReviewerResolver {
  constructor(private readonly port: ReviewerPort) {}

  async resolve(workspace: string, repo: string, request: ReviewerRequest): Promise<ReviewerRef[]> {
    const explicit = request.explicit.map(parseReviewerId)
    const defaults = request.useDefaults ? await this.port.getDefaultReviewers(workspace, repo) : []
    const author = await this.resolveAuthor(request)
    return mergeReviewers(request.current ?? [], [...defaults, ...explicit], author)
  }

  // Reading /user needs an extra token scope. With only explicit reviewers the
  // caller chose every ID, so a token without that scope should not block the PR.
  private async resolveAuthor(request: ReviewerRequest): Promise<ReviewerRef | undefined> {
    if (request.author) return request.author
    try {
      return await this.port.getCurrentUser()
    } catch (error) {
      if (request.useDefaults || !isForbidden(error)) throw error
      return undefined
    }
  }
}

function isForbidden(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('403')
}
