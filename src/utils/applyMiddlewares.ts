import {accessLogMiddleware, type AccessLogOptions} from "../access-log/index.js";
import {bodyParser, type BodyParserOptions} from "../body-parser/index.js";
import {type DrainInfo, gracefulShutdownMiddleware, type GracefulShutdownOptions} from "../graceful-shutdown/index.js";
import {type RequestChainOptions, requestIdMiddleware} from "../request-id/index.js";
import type {RequestHandler} from "express";
import {runMiddlewares} from "./runMiddlewares.js";

export type ApplyMiddlewaresOptions = {
  signal?: AbortSignal | false
  onDrain?: (info: DrainInfo) => void
  accessLog?: AccessLogOptions | false
  bodyParser?: BodyParserOptions | false
  gracefulShutdown?: Omit<GracefulShutdownOptions, 'signal' | 'onDrain'>
  requestId?: RequestChainOptions | false
}

export function applyMiddlewares(options: ApplyMiddlewaresOptions): RequestHandler {
  options ??= {}

  const middlewares: RequestHandler[] = [
    options.requestId !== false && requestIdMiddleware(options.requestId || {}),
    options.accessLog !== false && accessLogMiddleware(options.accessLog || {}),
    options.bodyParser !== false && bodyParser(options.bodyParser || {}),
    !!options.signal && !!options.onDrain && gracefulShutdownMiddleware({
      ...options.gracefulShutdown,
      signal: options.signal as AbortSignal,
      onDrain: options.onDrain
    })
  ].filter((mw): mw is RequestHandler => !!mw)

  return (req, res, next) =>
    runMiddlewares(middlewares, req, res, next)
}
