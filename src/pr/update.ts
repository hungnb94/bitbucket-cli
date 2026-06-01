import type { PullRequest } from './types.js'

export type UpdatePatch = {
  title?: string
  description?: string
}

export type UpdateInput = {
  title?: string
  description?: string
}

export function diffFields(current: PullRequest, input: UpdateInput): UpdatePatch {
  const patch: UpdatePatch = {}

  if (input.title !== undefined && input.title !== current.title) {
    patch.title = input.title
  }
  if (input.description !== undefined && input.description !== current.description) {
    patch.description = input.description
  }

  return patch
}
