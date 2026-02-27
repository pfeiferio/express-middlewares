import type {NextFunction, Request, RequestHandler, Response} from "express";
import type {BodyParserOptions} from "./types/types.js";
import {LIMIT_20_MB} from "./types/constants.js";
import {jsonMiddleware} from "./middlewares/JsonMiddleware.js";
import {urlEncodedMiddleware} from "./middlewares/UrlEncodedMiddleware.js";
import {multipartMiddleware} from "./middlewares/MultipartMiddleware.js";
import {rawMiddleware} from "./middlewares/RawMiddleware.js";
import {runMiddlewares} from "./utils/runMiddlewares.js";

export function bodyParser(options: BodyParserOptions = {}): RequestHandler {

  const {
    multipartLimit = LIMIT_20_MB,
    jsonLimit = LIMIT_20_MB,
    middleware = {}
  } = options

  const {json = {}, urlencoded = {}, multipart = false, raw = false} = middleware
  const middlewares: RequestHandler[] = []

  if (options.jsonLimit && middleware.json && middleware.json.limit) {
    throw new Error('Cannot set both "jsonLimit" and "json.limit".')
  }

  if (options.multipartLimit && middleware.multipart && middleware.multipart.limits?.fileSize) {
    throw new Error('Cannot set both "multipartLimit" and "multipart.limits.fileSize".')
  }

  const jsonOptions = json === false
    ? false
    : {
      ...json,
      ...(jsonLimit ? {limit: jsonLimit} : {})
    }

  const multipartOptions = multipart === false
    ? false
    : {
      ...multipart,
      ...(multipartLimit ? {
        limits: {
          ...multipart.limits,
          fileSize: multipartLimit
        }
      } : {})
    }

  if (jsonOptions !== false) jsonMiddleware(middlewares, options, jsonOptions)
  if (urlencoded !== false) urlEncodedMiddleware(middlewares, options, urlencoded)
  if (multipartOptions !== false) multipartMiddleware(middlewares, options, multipartOptions)
  if (raw !== false) rawMiddleware(middlewares, options, raw)

  return (req: Request, res: Response, next: NextFunction) =>
    runMiddlewares(middlewares, req, res, next)
}
