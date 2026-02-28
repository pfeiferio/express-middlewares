export type RequestChainOptions = {
  correlationIdHeaderName?: string
  requestIdHeaderName?: string
  chainHeaderName?: string
  setResponseHeader?: boolean
  maxChainLength?: number
  maxIdLength?: number
}

