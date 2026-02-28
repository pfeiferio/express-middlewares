import {parseChainString} from "./parseChainString.js";

export const INVALID_CHAIN = Symbol()

export function parseChainHeader(
  maxChainLength: number,
  maxIdLength: number,
  incoming: string | string[] | undefined
): string[] {

  if (Array.isArray(incoming)) {
    let res: string[] = []
    for (const s of incoming) {
      const tmp = parseChainString(maxChainLength, maxIdLength, s)

      if (tmp === INVALID_CHAIN) {
        return []
      }

      res.push(...tmp)

      if (res.length > maxChainLength) {
        return []
      }
    }
    return res
  }

  const tmp = parseChainString(maxChainLength, maxIdLength, incoming)
  return tmp === INVALID_CHAIN ? [] : tmp
}
