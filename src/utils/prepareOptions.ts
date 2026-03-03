import type {ApplyMiddlewaresOptions} from "./applyMiddlewares.js";
import type {CsrfMiddlewareOptions} from "@pfeiferio/express-csrf";

export const prepareOptions = (options: ApplyMiddlewaresOptions): ApplyMiddlewaresOptions => {

  options ??= {}
  options = {...options}

  if (options.gracefulShutdown !== false) {
    if (!options.signal || !options.onDrain) {
      throw new Error(
        'applyMiddlewares: gracefulShutdown requires "signal" and "onDrain". Set gracefulShutdown: false to disable.'
      )
    }
  }

  if (options.csrf !== false) {
    const csrfOptions: CsrfMiddlewareOptions = {...options.csrf || {}}
    if (!csrfOptions.internals?.signal && options.signal) {
      csrfOptions.internals ??= {}
      csrfOptions.internals.signal = options.signal
    }

    options.csrf = csrfOptions

    if (options.cookieParser === false && !csrfOptions.csrfSecretCookie?.cookieReader) {
      throw new Error(
        'applyMiddlewares: "cookieParser" is disabled but no "csrf.csrfSecretCookie.cookieReader" was provided'
      )
    }
  }

  return options
}
