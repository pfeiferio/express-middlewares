import {idRegexCheck} from "./idRegexCheck.js";

export function validatedIncomingId(
  maxIdLength: number,
  incoming: string | string[] | undefined
): string | undefined {
  if (Array.isArray(incoming)) {
    if (incoming.length > 1) {
      return
    }

    incoming = incoming[0]
  }

  if (!incoming || typeof incoming !== 'string') {
    return
  }

  const trimmed = incoming.trim()

  if (!trimmed) return

  if (trimmed.length > maxIdLength) {
    return
  }

  if (incoming.includes(',')) return
  if (!idRegexCheck(incoming)) return

  return trimmed
}
