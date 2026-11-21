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
    const author = request.author ?? (await this.port.getCurrentUser())
    return mergeReviewers(request.current ?? [], [...defaults, ...explicit], author)
  }
}
