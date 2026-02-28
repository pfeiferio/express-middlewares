import type {RequestChainOptions} from "../types/types.js";

export const validatedOptions = (
  options: RequestChainOptions,
  defaults: RequestChainOptions
): Required<RequestChainOptions> => {

  const {
    requestIdHeaderName = defaults.requestIdHeaderName,
    maxIdLength = defaults.maxIdLength,
    chainHeaderName = defaults.chainHeaderName,
    setResponseHeader = defaults.setResponseHeader,
    maxChainLength = defaults.maxChainLength,
    correlationIdHeaderName = defaults.correlationIdHeaderName,
  } = options

  if (typeof requestIdHeaderName !== 'string' || !requestIdHeaderName) {
    throw new Error('requestIdMiddleware: requestIdHeaderName must be a non-empty string')
  }

  if (typeof correlationIdHeaderName !== 'string' || !correlationIdHeaderName) {
    throw new Error('requestIdMiddleware: correlationIdHeaderName must be a non-empty string')
  }

  if (typeof chainHeaderName !== 'string' || !chainHeaderName) {
    throw new Error('requestIdMiddleware: chainHeaderName must be a non-empty string')
  }

  if (typeof setResponseHeader !== 'boolean') {
    throw new Error('requestIdMiddleware: setResponseHeader must be a boolean')
  }
  if (typeof maxChainLength !== 'number' || !Number.isInteger(maxChainLength) || maxChainLength < 0) {
    throw new Error('requestIdMiddleware: maxChainLength must be a number >= 0')
  }

  if (typeof maxIdLength !== 'number' || !Number.isInteger(maxIdLength) || maxIdLength < 0) {
    throw new Error('requestIdMiddleware: maxIdLength must be a number >= 0')
  }

  return {
    correlationIdHeaderName: correlationIdHeaderName.toLowerCase(),
    requestIdHeaderName: requestIdHeaderName.toLowerCase(),
    chainHeaderName: chainHeaderName.toLowerCase(),
    setResponseHeader,
    maxChainLength,
    maxIdLength,
  }
}
