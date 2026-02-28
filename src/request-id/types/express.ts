declare module 'express-serve-static-core' {
  interface Request {
    correlationId: string
    requestId: string
    requestChain: string[]
  }

  interface Locals {
    correlationId: string
    requestId: string
    requestChain: string[]
  }
}

export {};
