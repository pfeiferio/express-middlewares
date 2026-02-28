import type {RequestChainOptions} from "./types/types.js";
import type {RequestHandler} from "express";
import {validatedOptions} from "./utils/validatedOptions.js";
import crypto from "node:crypto";
import {parseChainHeader} from "./utils/parseChainHeader.js";
import {validatedIncomingId} from "./utils/validatedIncomingRequestId.js";

const defaults = {
  correlationIdHeaderName: 'x-correlation-id',
  requestIdHeaderName: 'x-request-id',
  chainHeaderName: 'x-request-chain',
  setResponseHeader: true,
  maxChainLength: 30,
  maxIdLength: 64
}

export function requestIdMiddleware(options: RequestChainOptions = {}): RequestHandler {

  const {
    requestIdHeaderName,
    chainHeaderName,
    setResponseHeader,
    maxChainLength,
    correlationIdHeaderName,
    maxIdLength
  } = validatedOptions(options, defaults)

  const useChain = maxChainLength > 0

  return (req, res, next) => {
    const incomingRequestId = validatedIncomingId(maxIdLength, req.headers[requestIdHeaderName])
    const correlationId = validatedIncomingId(maxIdLength, req.headers[correlationIdHeaderName]) ?? crypto.randomUUID()
    const requestId = crypto.randomUUID()
    let chain = useChain ? parseChainHeader(maxChainLength, maxIdLength, req.headers[chainHeaderName]) : []

    if (useChain) {
      if (incomingRequestId && chain[chain.length - 1] !== incomingRequestId) chain.push(incomingRequestId)
      chain.push(requestId)
    }

    if (useChain && chain.length > maxChainLength) {
      chain = chain.slice(-maxChainLength)
    }

    req.correlationId = correlationId
    req.requestId = requestId
    req.requestChain = chain

    res.locals.correlationId = correlationId
    res.locals.requestId = requestId
    res.locals.requestChain = chain

    if (setResponseHeader) {
      if (useChain) res.setHeader(chainHeaderName, chain.join(','))
      res.setHeader(requestIdHeaderName, requestId)
      res.setHeader(correlationIdHeaderName, correlationId)
    }

    next()
  }
}
