import {accessLogMiddleware, type AccessLogOptions} from "../access-log/index.js";
import {bodyParserMiddleware, type BodyParserOptions} from "../body-parser/index.js";
import {type DrainInfo, gracefulShutdownMiddleware, type GracefulShutdownOptions} from "../graceful-shutdown/index.js";
import {type RequestChainOptions, requestIdMiddleware} from "../request-id/index.js";
import type {RequestHandler} from "express";
import {runMiddlewares} from "./runMiddlewares.js";
import {csrfMiddleware, type CsrfMiddlewareOptions} from "@pfeiferio/express-csrf";
import {prepareOptions} from "./prepareOptions.js";
import cookieParser from 'cookie-parser'
import {fullUrlMiddleware} from "../full-url/index.js";
import type {ShutdownRegistry} from "request-drain";

export type ApplyMiddlewaresOptions = {
  fullUrl?: boolean
  signal?: AbortSignal | false
  shutdownRegistry?: ShutdownRegistry
  onDrain?: (info: DrainInfo) => void
  accessLog?: AccessLogOptions | false
  bodyParser?: BodyParserOptions | false
  gracefulShutdown?: Omit<GracefulShutdownOptions, 'signal' | 'onDrain' | 'shutdownRegistry'> | false
  requestId?: RequestChainOptions | false
  csrf?: CsrfMiddlewareOptions | false
  cookieParser?: boolean | { secret?: string | string[], options?: cookieParser.CookieParseOptions }
}

export function applyMiddlewares(options: ApplyMiddlewaresOptions): RequestHandler {
  options = prepareOptions(options)

  const middlewares: RequestHandler[] = [
    options.fullUrl !== false && fullUrlMiddleware(),
    options.requestId !== false && requestIdMiddleware(options.requestId || {}),
    options.accessLog !== false && accessLogMiddleware(options.accessLog || {}),
    options.bodyParser !== false && bodyParserMiddleware(options.bodyParser || {}),
    options.cookieParser !== false && cookieParser(
      typeof options.cookieParser === 'object' ? options.cookieParser.secret : undefined,
      typeof options.cookieParser === 'object' ? options.cookieParser.options : undefined
    ),
    options.csrf !== false && csrfMiddleware(options.csrf!),
    options.gracefulShutdown !== false && gracefulShutdownMiddleware({
      ...options.gracefulShutdown,
      ...(options.signal ? {signal: options.signal as AbortSignal} : {}),
      ...(options.shutdownRegistry ? {shutdownRegistry: options.shutdownRegistry} : {}),
      onDrain: options.onDrain!
    })
  ].filter((mw): mw is RequestHandler => !!mw)

  return (req, res, next) =>
    runMiddlewares(middlewares, req, res, next)
}
