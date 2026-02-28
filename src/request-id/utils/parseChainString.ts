import {INVALID_CHAIN} from "./parseChainHeader.js";
import {idRegexCheck} from "./idRegexCheck.js";

/**
 * Parses a comma-separated chain string into an array of IDs.
 * Uses a cursor-based approach to avoid unnecessary string allocations:
 * - cursorPosStart tracks the start of the current ID
 * - cursorPosEnd tracks the end (null = not yet seen trailing space)
 * - Leading/trailing spaces per ID are trimmed via cursor adjustment
 * - Any empty segment, oversized ID, or invalid character causes INVALID_CHAIN
 */
export function parseChainString(
  maxChainLength: number,
  maxIdLength: number,
  incoming: string | undefined
): string[] | typeof INVALID_CHAIN {

  if (typeof incoming !== 'string') {
    return INVALID_CHAIN
  }

  if (!idRegexCheck(incoming, true)) return INVALID_CHAIN

  if (incoming.length > (maxChainLength * maxIdLength) + 2 * maxChainLength) {
    return INVALID_CHAIN
  }

  const chain = []
  let start = false

  let cursorPosStart = 0
  let cursorPosEnd: number | null = 0

  for (let i = 0; i < incoming.length; i++) {

    const char = incoming[i]
    const isEmpty = char === ' '
    const isDelimiter = char === ','

    if (!start && isEmpty) {
      cursorPosStart = i + 1
      continue
    } else if (start && isEmpty) {
      cursorPosEnd ??= i
      continue
    }

    start = true

    if (!isDelimiter) {
      cursorPosEnd = null
      continue
    }

    cursorPosEnd ??= i

    if ((cursorPosEnd - cursorPosStart) > maxIdLength) {
      return INVALID_CHAIN
    }

    if (cursorPosStart === i) {
      return INVALID_CHAIN
    }

    start = false

    chain.push(
      incoming.substring(cursorPosStart, cursorPosEnd)
    )

    if (chain.length > maxChainLength) return INVALID_CHAIN
    cursorPosStart = i + 1
  }

  cursorPosEnd ??= incoming.length

  if (cursorPosStart < cursorPosEnd) {
    if ((cursorPosEnd - cursorPosStart) > maxIdLength) return INVALID_CHAIN
    chain.push(
      incoming.substring(cursorPosStart, cursorPosEnd)
    )
    if (chain.length > maxChainLength) return INVALID_CHAIN
  } else {
    return INVALID_CHAIN
  }

  return chain
}
