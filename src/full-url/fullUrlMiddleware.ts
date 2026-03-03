import type {RequestHandler} from "express";

export function fullUrlMiddleware(): RequestHandler {

  return (req, _res, next) => {
    req.fullUrl = `${req.protocol}://${req.host}${req.originalUrl}`
    req.hostUrl = `${req.protocol}://${req.host}`
    next()
  }
}
