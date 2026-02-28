/**
 * Creates an AbortSignal that is triggered when one of the specified signals is received.
 * After the first signal, all listeners are removed — a second signal will trigger Node's default behavior (hard kill).
 *
 * @param onSignal - Optional callback that receives the signal name before the abort is triggered.
 * @param signals - List of signals to listen for. Defaults to ['SIGINT', 'SIGTERM'].
 * @param _process - Overridable process instance — used for testing only.
 * @returns AbortSignal that is aborted when one of the signals is received.
 */
export function createShutdownSignal(
  onSignal?: (signal: NodeJS.Signals) => void,
  signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'],
  _process: NodeJS.Process = process
): AbortSignal {
  const controller = new AbortController()

  const handler = (sig: NodeJS.Signals) => {
    signals.forEach(sig => _process.off(sig, handler))
    onSignal?.(sig)
    controller.abort()
  }

  signals.forEach(sig => _process.on(sig, handler))

  return controller.signal
}
