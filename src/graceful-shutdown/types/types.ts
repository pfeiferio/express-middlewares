import type {RequestHandler} from "express";
import {ShutdownRegistry} from "request-drain";

export type DrainInfo = {
  pendingRequests: number
  isTimeout: boolean
}

export type GracefulShutdownOptions = {

  shutdownRegistry?: ShutdownRegistry

  /**
   * AbortSignal to trigger graceful shutdown.
   * Use createShutdownSignal() to create one that listens to SIGINT/SIGTERM.
   * Required if shutdownRegistry is not provided.
   */
  signal?: AbortSignal

  /**
   * Timeout in ms before forced drain.
   * -1 = immediate forced drain
   *  0 = wait forever (no timeout)
   * >0 = wait X ms, then forced drain
   * @default 10000
   */
  timeout?: number

  /**
   * Called when all pending requests have been drained or the timeout has been reached.
   */
  onDrain: (info: DrainInfo) => void

  /**
   * Called for every incoming request while the server is shutting down.
   * @default 503 JSON response
   */
  onReject?: RequestHandler

  /**
   * Forces all incoming requests to be rejected immediately, regardless of shutdown state.
   * Use this to test your onReject handler during development.
   * Must not be used in production.
   * @default false
   */
  forceReject?: boolean
}
