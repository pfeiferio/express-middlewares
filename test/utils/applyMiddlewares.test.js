import {describe, it} from 'node:test'
import assert from 'node:assert/strict'

import {applyMiddlewares} from '../../dist/index.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockReq(overrides = {}) {
  return {
    method: 'GET',
    headers: {},
    body: undefined,
    connection: {remoteAddress: '127.0.0.1'},
    socket: {remoteAddress: '127.0.0.1'},
    get(header) { return this.headers[header.toLowerCase()] },
    is(type) {
      const ct = this.headers['content-type'] || ''
      return ct.includes(type) ? type : false
    },
    ...overrides
  }
}

function mockRes() {
  const headers = {}
  const locals = {}
  return {
    headers,
    locals,
    statusCode: undefined,
    body: undefined,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
    send(body) { this.body = body; return this },
    setHeader(name, value) { headers[name] = value },
    cookie(name, value, options) { return this },
    on() { return this }
  }
}

function runMw(mw, req, res) {
  return new Promise((resolve) => {
    const r = res ?? mockRes()
    mw(req ?? mockReq(), r, (err) => resolve({err: err ?? null}))
    // resolve auch wenn next nie aufgerufen wird (z.B. bei onReject)
    setTimeout(() => resolve({err: null}), 50)
  })
}


function makeSignal() {
  const controller = new AbortController()
  return {signal: controller.signal, abort: () => controller.abort()}
}

// ─── applyMiddlewares – defaults ──────────────────────────────────────────────

describe('applyMiddlewares – defaults', () => {
  it('calls next() with no options', async () => {
    const mw = applyMiddlewares({gracefulShutdown: false, csrf: false})
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })

  it('sets req.requestId by default', async () => {
    const mw = applyMiddlewares({gracefulShutdown: false, csrf: false})
    const req = mockReq()
    await runMw(mw, req)
    assert.match(req.requestId, /^[0-9a-f-]{36}$/)
  })

  it('sets req.requestChain by default', async () => {
    const mw = applyMiddlewares({gracefulShutdown: false, csrf: false})
    const req = mockReq()
    await runMw(mw, req)
    assert.ok(Array.isArray(req.requestChain))
  })

  it('parses json body by default', async () => {
    const mw = applyMiddlewares({gracefulShutdown: false, csrf: false})
    const req = mockReq({headers: {'content-type': 'application/json'}})
    const {err} = await runMw(mw, req)
    assert.equal(err, null)
  })
})

// ─── applyMiddlewares – disable middlewares ───────────────────────────────────

describe('applyMiddlewares – disable middlewares', () => {
  it('requestId: false – req.requestId not set', async () => {
    const mw = applyMiddlewares({requestId: false, gracefulShutdown: false, csrf: false})
    const req = mockReq()
    await runMw(mw, req)
    assert.equal(req.requestId, undefined)
  })

  it('bodyParser: false – body stays undefined', async () => {
    const mw = applyMiddlewares({bodyParser: false, gracefulShutdown: false, csrf: false})
    const req = mockReq({headers: {'content-type': 'application/json'}})
    await runMw(mw, req)
    assert.equal(req.body, undefined)
  })

  it('accessLog: false – calls next()', async () => {
    const mw = applyMiddlewares({accessLog: false, gracefulShutdown: false, csrf: false})
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })
})

// ─── applyMiddlewares – gracefulShutdown ──────────────────────────────────────

describe('applyMiddlewares – gracefulShutdown', () => {
  it('gracefulShutdown: false – not active, calls next()', async () => {
    const mw = applyMiddlewares({gracefulShutdown: false, csrf: false})
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })

  it('throws when signal is missing', () => {
    assert.throws(
      () => applyMiddlewares({onDrain: () => {}, csrf: false}),
      /gracefulShutdown requires/
    )
  })

  it('throws when onDrain is missing', () => {
    const {signal} = makeSignal()
    assert.throws(
      () => applyMiddlewares({signal, csrf: false}),
      /gracefulShutdown requires/
    )
  })

  it('throws when signal is false', () => {
    assert.throws(
      () => applyMiddlewares({signal: false, onDrain: () => {}, csrf: false}),
      /gracefulShutdown requires/
    )
  })

  it('signal + onDrain – gracefulShutdown active, calls next()', async () => {
    const {signal} = makeSignal()
    const mw = applyMiddlewares({signal, onDrain: () => {}, csrf: false})
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })

  it('signal + onDrain – rejects after abort', async () => {
    const {signal, abort} = makeSignal()
    const mw = applyMiddlewares({signal, onDrain: () => {}, csrf: false})

    abort()
    await new Promise(resolve => setTimeout(resolve, 10))

    const res = mockRes()
    await runMw(mw, mockReq(), res)
    assert.equal(res.statusCode, 503)
  })
})

// ─── applyMiddlewares – cookieParser ──────────────────────────────────────────

describe('applyMiddlewares – cookieParser', () => {
  it('cookieParser: false – calls next()', async () => {
    const mw = applyMiddlewares({cookieParser: false, gracefulShutdown: false, csrf: false})
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })

  it('cookieParser: {secret} – calls next()', async () => {
    const mw = applyMiddlewares({cookieParser: {secret: 'test-secret'}, gracefulShutdown: false, csrf: false})
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })
})

// ─── applyMiddlewares – csrf ───────────────────────────────────────────────────

describe('applyMiddlewares – csrf', () => {
  it('csrf enabled – calls next()', async () => {
    const mw = applyMiddlewares({gracefulShutdown: false})
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })

  it('csrf enabled, cookieParser: false without cookieReader – throws', () => {
    assert.throws(
      () => applyMiddlewares({cookieParser: false, gracefulShutdown: false}),
      /"cookieParser" is disabled/
    )
  })

  it('csrf enabled, cookieParser: false with cookieReader – calls next()', async () => {
    const mw = applyMiddlewares({
      cookieParser: false,
      gracefulShutdown: false,
      csrf: {csrfSecretCookie: {cookieReader: () => 'secret'}}
    })
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })

  it('csrf enabled with signal – propagates signal to csrf internals', async () => {
    const {signal} = makeSignal()
    const mw = applyMiddlewares({signal, onDrain: () => {}})
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })

  it('csrf with explicit internals object and signal – skips internals init', async () => {
    const {signal} = makeSignal()
    const mw = applyMiddlewares({signal, onDrain: () => {}, csrf: {internals: {}}})
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })
})

// ─── applyMiddlewares – order ─────────────────────────────────────────────────

describe('applyMiddlewares – middleware order', () => {
  it('requestId is set before next()', async () => {
    const mw = applyMiddlewares({gracefulShutdown: false, csrf: false})
    const req = mockReq()
    await runMw(mw, req)
    assert.ok(req.requestId)
    assert.ok(req.requestChain)
  })
})
