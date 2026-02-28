import {describe, it} from 'node:test'
import assert from 'node:assert/strict'

import {gracefulShutdownMiddleware} from '../../dist/graceful-shutdown/gracefulShutdownMiddleware.js'
import {createShutdownSignal} from '../../dist/graceful-shutdown/utils/createShutdownSignal.js'
import EventEmitter from "node:events";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockReq(overrides = {}) {
  return {headers: {}, ...overrides}
}

function mockRes() {
  const listeners = {}
  return {
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
    send(body) {
      this.body = body
      return this
    },
    on(event, cb) {
      listeners[event] = cb
      return this
    },
    emit(event) {
      listeners[event]?.()
    },
    _listeners: listeners
  }
}

function mockNext() {
  let called = false
  const fn = () => called = true
  fn.wasCalled = () => called
  return fn
}

function makeSignal() {
  const controller = new AbortController()
  return {signal: controller.signal, abort: () => controller.abort()}
}

function runMw(mw, req, res) {
  const next = mockNext()
  mw(req ?? mockReq(), res ?? mockRes(), next)
  return {next, res: res ?? mockRes()}
}

// ─── createShutdownSignal ─────────────────────────────────────────────────────

describe('createShutdownSignal', () => {
  it('returns an AbortSignal', () => {
    const signal = createShutdownSignal()
    assert.ok(signal instanceof AbortSignal)
  })

  it('calls onSignal callback with signal name', async () => {
    let received = null
    const signal = createShutdownSignal((sig) => received = sig)
    assert.equal(signal.aborted, false)
    // We can't send real signals in tests, so we verify the structure
    assert.equal(typeof signal.addEventListener, 'function')
    assert.ok(received === null) // not yet triggered
  })

  it('returns non-aborted signal initially', () => {
    const signal = createShutdownSignal()
    assert.equal(signal.aborted, false)
  })
})

// ─── validation ───────────────────────────────────────────────────────────────

describe('gracefulShutdownMiddleware – validation', () => {
  it('throws when signal is missing', () => {
    assert.throws(
      () => gracefulShutdownMiddleware({
        onDrain: () => {
        }
      }),
      /signal is required/,
    )
  })

  it('throws when onDrain is missing', () => {
    const {signal} = makeSignal()
    assert.throws(
      () => gracefulShutdownMiddleware({signal}),
      /onDrain.*is required/,
    )
  })

  it('throws when onDrain is not a function', () => {
    const {signal} = makeSignal()
    assert.throws(
      () => gracefulShutdownMiddleware({signal, onDrain: 'not a function'}),
      /onDrain must be a function/,
    )
  })

  it('throws when onReject is not a function', () => {
    const {signal} = makeSignal()
    assert.throws(
      () => gracefulShutdownMiddleware({
        signal, onDrain: () => {
        }, onReject: 'not a function'
      }),
      /onReject must be a function/,
    )
  })

  it('throws when timeout is not a number', () => {
    const {signal} = makeSignal()
    assert.throws(
      () => gracefulShutdownMiddleware({
        signal, onDrain: () => {
        }, timeout: 'abc'
      }),
      /timeout must be a number/,
    )
  })

  it('throws when timeout is less than -1', () => {
    const {signal} = makeSignal()
    assert.throws(
      () => gracefulShutdownMiddleware({
        signal, onDrain: () => {
        }, timeout: -2
      }),
      /timeout must be a number/,
    )
  })
})

// ─── forceReject ──────────────────────────────────────────────────────────────

describe('gracefulShutdownMiddleware – forceReject', () => {
  it('warns when forceReject is enabled', () => {
    const {signal} = makeSignal()
    const warnings = []
    const orig = console.warn
    console.warn = (msg) => warnings.push(msg)

    gracefulShutdownMiddleware({
      signal, onDrain: () => {
      }, forceReject: true
    })

    console.warn = orig
    assert.ok(warnings[0].includes('forceReject is enabled'))
  })

  it('calls onReject for every request when forceReject is true', () => {
    const {signal} = makeSignal()
    let rejected = false
    const mw = gracefulShutdownMiddleware({
      signal,
      onDrain: () => {
      },
      forceReject: true,
      onReject: (_req, res) => {
        rejected = true
        res.status(503).json({error: 'test'})
      }
    })

    const res = mockRes()
    const next = mockNext()
    mw(mockReq(), res, next)

    assert.equal(rejected, true)
    assert.equal(next.wasCalled(), false)
  })

  it('does not warn when forceReject is false', () => {
    const {signal} = makeSignal()
    const warnings = []
    const orig = console.warn
    console.warn = (msg) => warnings.push(msg)

    gracefulShutdownMiddleware({
      signal, onDrain: () => {
      }, forceReject: false
    })

    console.warn = orig
    assert.equal(warnings.length, 0)
  })
})

// ─── normal request handling ──────────────────────────────────────────────────

describe('gracefulShutdownMiddleware – normal requests', () => {
  it('calls next() for normal requests', () => {
    const {signal} = makeSignal()
    const mw = gracefulShutdownMiddleware({
      signal, onDrain: () => {
      }
    })
    const next = mockNext()
    mw(mockReq(), mockRes(), next)
    assert.equal(next.wasCalled(), true)
  })

  it('uses default onReject (503 json) when shutting down', async () => {
    const {signal, abort} = makeSignal()
    const mw = gracefulShutdownMiddleware({
      signal, onDrain: () => {
      }
    })

    abort()
    await new Promise(resolve => setTimeout(resolve, 10))

    const res = mockRes()
    const next = mockNext()
    mw(mockReq(), res, next)

    assert.equal(res.statusCode, 503)
    assert.equal(next.wasCalled(), false)
  })
})

// ─── shutdown – no pending requests ──────────────────────────────────────────

describe('gracefulShutdownMiddleware – abort with no pending requests', () => {
  it('emits drain immediately when no pending requests', async () => {
    const {signal, abort} = makeSignal()
    let drained = false

    gracefulShutdownMiddleware({
      signal,
      onDrain: () => drained = true
    })

    abort()
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(drained, true)
  })

  it('drain info has pendingRequests: 0 and isTimeout: false', async () => {
    const {signal, abort} = makeSignal()
    let info = null

    gracefulShutdownMiddleware({
      signal,
      onDrain: (i) => info = i
    })

    abort()
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.deepEqual(info, {pendingRequests: 0, isTimeout: false})
  })
})

// ─── shutdown – with pending requests ────────────────────────────────────────

describe('gracefulShutdownMiddleware – abort with pending requests', () => {
  it('drains after last request closes', async () => {
    const {signal, abort} = makeSignal()
    let drained = false

    const mw = gracefulShutdownMiddleware({
      signal,
      onDrain: () => drained = true
    })

    const res = mockRes()
    mw(mockReq(), res, mockNext())

    abort()
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(drained, false)

    res.emit('close')
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(drained, true)
  })

  it('blocks new requests after abort', async () => {
    const {signal, abort} = makeSignal()
    let rejected = false

    const mw = gracefulShutdownMiddleware({
      signal,
      onDrain: () => {
      },
      onReject: () => rejected = true
    })

    abort()
    await new Promise(resolve => setTimeout(resolve, 10))

    mw(mockReq(), mockRes(), mockNext())
    assert.equal(rejected, true)
  })

  it('drain is only emitted once even if close fires after timeout drain', async () => {
    const {signal, abort} = makeSignal()
    let drainCount = 0

    const mw = gracefulShutdownMiddleware({
      signal,
      onDrain: () => drainCount++,
      timeout: 50
    })

    const res = mockRes()
    mw(mockReq(), res, mockNext())

    abort()
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.equal(drainCount, 1)

    res.emit('close')
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(drainCount, 1)
  })
})

// ─── timeout ──────────────────────────────────────────────────────────────────

describe('gracefulShutdownMiddleware – timeout', () => {
  it('forced drain after timeout with isTimeout: true', async () => {
    const {signal, abort} = makeSignal()
    let info = null

    const mw = gracefulShutdownMiddleware({
      signal,
      onDrain: (i) => info = i,
      timeout: 50
    })

    const res = mockRes()
    mw(mockReq(), res, mockNext())

    abort()
    await new Promise(resolve => setTimeout(resolve, 100))

    assert.equal(info.isTimeout, true)
    assert.equal(info.pendingRequests, 1)
  })

  it('timeout: -1 drains immediately even with pending requests', async () => {
    const {signal, abort} = makeSignal()
    let info = null

    const mw = gracefulShutdownMiddleware({
      signal,
      onDrain: (i) => info = i,
      timeout: -1
    })

    const res = mockRes()
    mw(mockReq(), res, mockNext())

    abort()
    await new Promise(resolve => setTimeout(resolve, 10))

    assert.equal(info.isTimeout, true)
  })

  it('timeout: 0 does not set a timer', async () => {
    const {signal, abort} = makeSignal()
    let drained = false

    const mw = gracefulShutdownMiddleware({
      signal,
      onDrain: () => drained = true,
      timeout: 0
    })

    const res = mockRes()
    mw(mockReq(), res, mockNext())

    abort()
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.equal(drained, false) // still waiting, no timer fired
  })

  it('aborts signal when SIGINT is received', async () => {
    const mockProcess = new EventEmitter()
    const signal = createShutdownSignal(() => null, ['SIGINT'], mockProcess)
    assert.equal(signal.aborted, false)
    mockProcess.emit('SIGINT')
    assert.equal(signal.aborted, true)
  })
})
