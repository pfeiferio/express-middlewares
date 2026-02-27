import type {NextFunction, Request, RequestHandler, Response} from "express";

export function runMiddlewares(middlewares: RequestHandler[], req: Request, res: Response, next: NextFunction) {
  req.groupedFiles = {}
  middlewares = [...middlewares]
  const run = (err?: unknown) => {
    if (err) return next(err)
    const mw = middlewares.shift()
    if (!mw) return next()
    try {
      mw(req, res, run)
    } catch (e) {
      next(e)
    }
  }
  run()
}
