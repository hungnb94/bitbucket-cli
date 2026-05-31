import type { PullRequest } from './types.js'
import { getUserByUsername } from '../api/users.js'

export type UpdatePatch = {
  title?: string
  description?: string
  destination?: { branch: { name: string } }
  reviewers?: { uuid: string }[]
  closeSourceBranch?: boolean
}

export type UpdateInput = {
  title?: string
  description?: string
  target?: string
  addReviewers?: string[]
  removeReviewers?: string[]
  closeSourceBranch?: boolean
}

export async function resolveReviewerUsernames(
  usernames: string[]
): Promise<{ uuid: string }[]> {
  if (usernames.length === 0) return []
  const results = await Promise.allSettled(usernames.map((u) => getUserByUsername(u)))
  const errors = results
    .map((r, i) =>
      r.status === 'rejected'
        ? (r.reason instanceof Error ? r.reason.message : String(r.reason))
        : null
    )
    .filter((e): e is string => e !== null)
  if (errors.length > 0) throw new Error(errors.join('\n'))
  return (results as PromiseFulfilledResult<{ uuid: string; displayName: string }>[]).map(
    (r) => ({ uuid: r.value.uuid })
  )
}

export async function buildReviewerPatch(
  currentUuids: string[],
  addNames: string[],
  removeNames: string[]
): Promise<{ uuid: string }[] | undefined> {
  const dups = addNames.filter((n) => removeNames.includes(n))
  if (dups.length > 0) {
    throw new Error(
      dups.map((n) => `${n} appears in both --add-reviewer and --remove-reviewer.`).join('\n')
    )
  }

  const [addUuids, removeUuids] = await Promise.all([
    resolveReviewerUsernames(addNames),
    resolveReviewerUsernames(removeNames),
  ])

  const removeSet = new Set(removeUuids.map((r) => r.uuid))
  const addUuidStrings = addUuids.map((a) => a.uuid)

  const newUuids = [
    ...currentUuids.filter((u) => !removeSet.has(u)),
    ...addUuidStrings.filter((u) => !currentUuids.includes(u)),
  ]

  const currentSet = new Set(currentUuids)
  const newSet = new Set(newUuids)
  const unchanged =
    currentSet.size === newSet.size && [...currentSet].every((u) => newSet.has(u))
  if (unchanged) return undefined

  return newUuids.map((uuid) => ({ uuid }))
}

export function diffFields(
  current: PullRequest,
  input: UpdateInput,
  newReviewers?: { uuid: string }[]
): UpdatePatch {
  const patch: UpdatePatch = {}

  if (input.title !== undefined && input.title !== current.title) {
    patch.title = input.title
  }
  if (input.description !== undefined && input.description !== current.description) {
    patch.description = input.description
  }
  if (input.target !== undefined && input.target !== current.destBranch) {
    patch.destination = { branch: { name: input.target } }
  }
  if (newReviewers !== undefined) {
    patch.reviewers = newReviewers
  }
  if (
    input.closeSourceBranch !== undefined &&
    input.closeSourceBranch !== current.closeSourceBranch
  ) {
    patch.closeSourceBranch = input.closeSourceBranch
  }

  return patch
}
