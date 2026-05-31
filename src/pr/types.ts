export type PullRequest = {
  id: number
  title: string
  authorName: string
  state: 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED'
  updatedOn: string
  description: string
  reviewerNames: string[]
  reviewerUuids: string[]
  closeSourceBranch: boolean
  sourceBranch: string
  destBranch: string
}

export type DiffStat = {
  additions: number
  deletions: number
  filesChanged: number
}
