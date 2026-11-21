export type ReviewerRef = {
  uuid?: string
  account_id?: string
  displayName?: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BRACED_UUID = /^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i
const ACCOUNT_ID = /^(?:[0-9a-f]{24}|\d+:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export function parseReviewerId(raw: string): ReviewerRef {
  const value = raw.trim()
  if (!value) throw new Error('Reviewer ID cannot be empty.')
  if (BRACED_UUID.test(value)) return { uuid: value.toLowerCase() }
  if (UUID.test(value)) return { uuid: `{${value.toLowerCase()}}` }
  if (ACCOUNT_ID.test(value)) return { account_id: value }
  throw new Error(`Invalid reviewer ID "${value}". Use a uuid or an account_id.`)
}

export function reviewerLabel(ref: ReviewerRef): string {
  return ref.displayName ?? ref.uuid ?? ref.account_id ?? '(unknown)'
}

export function sameReviewer(a: ReviewerRef, b: ReviewerRef): boolean {
  return (
    (a.uuid !== undefined && a.uuid === b.uuid) ||
    (a.account_id !== undefined && a.account_id === b.account_id)
  )
}

export function mergeReviewers(
  current: ReviewerRef[],
  requested: ReviewerRef[],
  author?: ReviewerRef
): ReviewerRef[] {
  const merged: ReviewerRef[] = []
  for (const reviewer of [...current, ...requested]) {
    if (author && sameReviewer(reviewer, author)) continue
    const index = merged.findIndex((existing) => sameReviewer(existing, reviewer))
    if (index === -1) merged.push(reviewer)
    else merged[index] = { ...merged[index], ...withoutUndefined(reviewer) }
  }
  return merged
}

function withoutUndefined(ref: ReviewerRef): ReviewerRef {
  return Object.fromEntries(Object.entries(ref).filter(([, v]) => v !== undefined))
}
