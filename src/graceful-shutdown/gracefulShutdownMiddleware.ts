import type {NextFunction, Request, RequestHandler, Response} from "express";
import type {GracefulShutdownOptions} from "./types/types.js";
import EventEmitter from "node:events";

const defaultOnReject: RequestHandler = (_req, res) =>
  res.status(503).json({error: 'server shutting down'})

/**
 * Express middleware for graceful shutdown handling.
 * Tracks pending requests and drains them before allowing the process to exit.
 * New incoming requests are rejected with a 503 response (or a custom handler) once shutdown is initiated.
 *
 * @param options - Configuration options.
 * @returns Express RequestHandler to be registered via app.use().
 *
 * @example
 * const signal = createShutdownSignal()
 *
 * app.use(gracefulShutdownMiddleware({
 *   signal,
 *   onDrain: () => server.close(() => process.exit(0))
 * }))
 */
export function gracefulShutdownMiddleware(options: GracefulShutdownOptions): RequestHandler {

  const {
    signal,
    timeout = 10000,
    onDrain,
    onReject = defaultOnReject
  } = options;

  const forceReject = options.forceReject === true
  const pendingRequests = new Set<symbol>()
  const eventHandle = new EventEmitter()
  const states = {
    shuttingDown: false,
    drained: false
  }

  if (forceReject) {
    console.warn('gracefulShutdownMiddleware: forceReject is enabled — this should only be used for testing and must not be used in production.')
  }

  if (!signal) {
    throw new Error('gracefulShutdownMiddleware: signal is required')
  }

  if (!onDrain) {
    throw new Error(
      'gracefulShutdownMiddleware: "onDrain" is required.\n' +
      'Example:\n' +
      '  const server = app.listen(3000)\n' +
      '  app.use(gracefulShutdownMiddleware({\n' +
      '    signal,\n' +
      '    onDrain: () => server.close(() => process.exit(0))\n' +
      '  }))'
    )
  }

  if (typeof onDrain !== 'function') {
    throw new Error('gracefulShutdownMiddleware: onDrain must be a function')
  }

  if (typeof onReject !== 'function') {
    throw new Error('gracefulShutdownMiddleware: onReject must be a function')
  }

  if (typeof timeout !== 'number' || timeout < -1) {
    throw new Error('gracefulShutdownMiddleware: timeout must be a number >= -1')
  }

  const emitDrain = (isTimeout = false) => {
    if (states.drained) return
    states.drained = true
    eventHandle.emit('drain', {
      pendingRequests: pendingRequests.size,
      isTimeout
    })
  }

  eventHandle.once('drain', onDrain)

  signal.addEventListener('abort', () => {
    states.shuttingDown = true

    if (pendingRequests.size === 0) {
      emitDrain()
      return
    }

    if (timeout > 0) {
      setTimeout(() => {
        emitDrain(true)
      }, timeout).unref()
    } else if (timeout === -1) {
      emitDrain(true)
    }
  }, {once: true})

  return (req: Request, res: Response, next: NextFunction) => {

    if (states.shuttingDown || forceReject) {
      onReject(req, res, next)
      return
    }

    const id = Symbol()
    pendingRequests.add(id)

    res.on('close', () => {
      pendingRequests.delete(id)

      if (states.shuttingDown && pendingRequests.size === 0) {
        emitDrain()
      }
    })

    return next()
  }
}
