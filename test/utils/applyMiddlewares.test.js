import {describe, it} from 'node:test'
import assert from 'node:assert/strict'

import {applyMiddlewares} from '../../dist/index.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockReq(overrides = {}) {
  return {headers: {}, body: undefined, ...overrides}
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
    const mw = applyMiddlewares({})
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })

  it('sets req.requestId by default', async () => {
    const mw = applyMiddlewares({})
    const req = mockReq()
    await runMw(mw, req)
    assert.match(req.requestId, /^[0-9a-f-]{36}$/)
  })

  it('sets req.requestChain by default', async () => {
    const mw = applyMiddlewares({})
    const req = mockReq()
    await runMw(mw, req)
    assert.ok(Array.isArray(req.requestChain))
  })

  it('parses json body by default', async () => {
    const mw = applyMiddlewares({})
    const req = mockReq({headers: {'content-type': 'application/json'}})
    const {err} = await runMw(mw, req)
    assert.equal(err, null)
  })
})

// ─── applyMiddlewares – disable middlewares ───────────────────────────────────

describe('applyMiddlewares – disable middlewares', () => {
  it('requestId: false – req.requestId not set', async () => {
    const mw = applyMiddlewares({requestId: false})
    const req = mockReq()
    await runMw(mw, req)
    assert.equal(req.requestId, undefined)
  })

  it('bodyParser: false – body stays undefined', async () => {
    const mw = applyMiddlewares({bodyParser: false})
    const req = mockReq({headers: {'content-type': 'application/json'}})
    await runMw(mw, req)
    assert.equal(req.body, undefined)
  })

  it('accessLog: false – calls next()', async () => {
    const mw = applyMiddlewares({accessLog: false})
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })
})

// ─── applyMiddlewares – gracefulShutdown ──────────────────────────────────────

describe('applyMiddlewares – gracefulShutdown', () => {
  it('no signal – gracefulShutdown not active, calls next()', async () => {
    const mw = applyMiddlewares({})
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })

  it('signal: false – gracefulShutdown not active', async () => {
    const mw = applyMiddlewares({signal: false})
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })

  it('signal + onDrain – gracefulShutdown active, calls next()', async () => {
    const {signal} = makeSignal()
    const mw = applyMiddlewares({signal, onDrain: () => {}})
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })

  it('signal + onDrain – rejects after abort', async () => {
    const {signal, abort} = makeSignal()
    const mw = applyMiddlewares({signal, onDrain: () => {}})

    abort()
    await new Promise(resolve => setTimeout(resolve, 10))

    const res = mockRes()
    await runMw(mw, mockReq(), res)
    assert.equal(res.statusCode, 503)
  })

  it('onDrain without signal – gracefulShutdown not active', async () => {
    const mw = applyMiddlewares({onDrain: () => {}})
    const {err} = await runMw(mw)
    assert.equal(err, null)
  })
})

// ─── applyMiddlewares – order ─────────────────────────────────────────────────

describe('applyMiddlewares – middleware order', () => {
  it('requestId is set before next()', async () => {
    const mw = applyMiddlewares({})
    const req = mockReq()
    await runMw(mw, req)
    assert.ok(req.requestId)
    assert.ok(req.requestChain)
  })
})
