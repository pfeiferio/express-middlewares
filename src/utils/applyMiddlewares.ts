import {accessLogMiddleware, type AccessLogOptions} from "../access-log/index.js";
import {bodyParser, type BodyParserOptions} from "../body-parser/index.js";
import {type DrainInfo, gracefulShutdownMiddleware, type GracefulShutdownOptions} from "../graceful-shutdown/index.js";
import {type RequestChainOptions, requestIdMiddleware} from "../request-id/index.js";
import type {RequestHandler} from "express";
import {runMiddlewares} from "./runMiddlewares.js";
import {csrfMiddleware, type CsrfMiddlewareOptions} from "@pfeiferio/express-csrf";
import {prepareOptions} from "./prepareOptions.js";
import cookieParser from 'cookie-parser'

export type ApplyMiddlewaresOptions = {
  signal?: AbortSignal | false
  onDrain?: (info: DrainInfo) => void
  accessLog?: AccessLogOptions | false
  bodyParser?: BodyParserOptions | false
  gracefulShutdown?: Omit<GracefulShutdownOptions, 'signal' | 'onDrain'> | false
  requestId?: RequestChainOptions | false
  csrf?: CsrfMiddlewareOptions | false
  cookieParser?: boolean | { secret?: string | string[], options?: cookieParser.CookieParseOptions }
}

export function applyMiddlewares(options: ApplyMiddlewaresOptions): RequestHandler {
  options = prepareOptions(options)

  const middlewares: RequestHandler[] = [
    options.requestId !== false && requestIdMiddleware(options.requestId || {}),
    options.accessLog !== false && accessLogMiddleware(options.accessLog || {}),
    options.bodyParser !== false && bodyParser(options.bodyParser || {}),
    options.cookieParser !== false && cookieParser(
      typeof options.cookieParser === 'object' ? options.cookieParser.secret : undefined,
      typeof options.cookieParser === 'object' ? options.cookieParser.options : undefined
    ),
    options.csrf !== false && csrfMiddleware(options.csrf!),
    options.gracefulShutdown !== false && gracefulShutdownMiddleware({
      ...options.gracefulShutdown,
      signal: options.signal as AbortSignal,
      onDrain: options.onDrain!
    })
  ].filter((mw): mw is RequestHandler => !!mw)

  return (req, res, next) =>
    runMiddlewares(middlewares, req, res, next)
}
