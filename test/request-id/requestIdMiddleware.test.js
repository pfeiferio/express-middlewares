import {describe, it} from 'node:test'
import assert from 'node:assert/strict'

import {requestIdMiddleware} from '../../dist/request-id/index.js'
import {validatedOptions} from '../../dist/request-id/utils/validatedOptions.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockReq(overrides = {}) {
  return {headers: {}, ...overrides}
}

function mockRes() {
  const headers = {}
  const locals = {}
  return {
    headers,
    locals,
    setHeader(name, value) {
      headers[name] = value
    }
  }
}

function runMw(mw, req, res) {
  let nextCalled = false
  mw(req ?? mockReq(), res ?? mockRes(), () => nextCalled = true)
  return {nextCalled, req, res}
}

// ─── validatedOptions ─────────────────────────────────────────────────────────

describe('validatedOptions', () => {
  const defaults = {
    correlationIdHeaderName: 'x-correlation-id',
    requestIdHeaderName: 'x-request-id',
    chainHeaderName: 'x-request-chain',
    setResponseHeader: true,
    maxChainLength: 30,
    maxIdLength: 64,
  }

  it('returns merged options with defaults', () => {
    const result = validatedOptions({}, defaults)
    assert.deepEqual(result, defaults)
  })

  it('throws when requestIdHeaderName is empty string', () => {
    assert.throws(
      () => validatedOptions({requestIdHeaderName: ''}, defaults),
      /requestIdHeaderName must be a non-empty string/
    )
  })

  it('throws when requestIdHeaderName is not a string', () => {
    assert.throws(
      () => validatedOptions({requestIdHeaderName: 123}, defaults),
      /requestIdHeaderName must be a non-empty string/
    )
  })

  it('throws when chainHeaderName is empty string', () => {
    assert.throws(
      () => validatedOptions({chainHeaderName: ''}, defaults),
      /chainHeaderName must be a non-empty string/
    )
  })

  it('throws when chainHeaderName is not a string', () => {
    assert.throws(
      () => validatedOptions({chainHeaderName: 123}, defaults),
      /chainHeaderName must be a non-empty string/
    )
  })

  it('throws when setResponseHeader is not a boolean', () => {
    assert.throws(
      () => validatedOptions({setResponseHeader: 'yes'}, defaults),
      /setResponseHeader must be a boolean/
    )
  })

  it('throws when maxChainLength is not a number', () => {
    assert.throws(
      () => validatedOptions({maxChainLength: 'abc'}, defaults),
      /maxChainLength must be a number/
    )
  })

  it('throws when maxChainLength is negative', () => {
    assert.throws(
      () => validatedOptions({maxChainLength: -1}, defaults),
      /maxChainLength must be a number/
    )
  })

  it('accepts maxChainLength: 0', () => {
    assert.doesNotThrow(() => validatedOptions({maxChainLength: 0}, defaults))
  })
})

// ─── requestIdMiddleware ──────────────────────────────────────────────────────

describe('requestIdMiddleware – defaults', () => {
  it('calls next()', () => {
    const mw = requestIdMiddleware()
    const {nextCalled} = runMw(mw)
    assert.equal(nextCalled, true)
  })

  it('sets req.requestId as UUID', () => {
    const mw = requestIdMiddleware()
    const req = mockReq()
    runMw(mw, req)
    assert.match(req.requestId, /^[0-9a-f-]{36}$/)
  })

  it('sets req.requestChain as array containing requestId', () => {
    const mw = requestIdMiddleware()
    const req = mockReq()
    runMw(mw, req)
    assert.ok(Array.isArray(req.requestChain))
    assert.ok(req.requestChain.includes(req.requestId))
  })

  it('sets res.locals.requestId', () => {
    const mw = requestIdMiddleware()
    const req = mockReq()
    const res = mockRes()
    runMw(mw, req, res)
    assert.equal(res.locals.requestId, req.requestId)
  })

  it('sets res.locals.requestChain', () => {
    const mw = requestIdMiddleware()
    const req = mockReq()
    const res = mockRes()
    runMw(mw, req, res)
    assert.deepEqual(res.locals.requestChain, req.requestChain)
  })

  it('sets x-request-id response header', () => {
    const mw = requestIdMiddleware()
    const req = mockReq()
    const res = mockRes()
    runMw(mw, req, res)
    assert.equal(res.headers['x-request-id'], req.requestId)
  })

  it('sets x-request-chain response header', () => {
    const mw = requestIdMiddleware()
    const req = mockReq()
    const res = mockRes()
    runMw(mw, req, res)
    assert.equal(res.headers['x-request-chain'], req.requestChain.join(','))
  })
})

// ─── requestIdMiddleware – chain propagation ──────────────────────────────────

describe('requestIdMiddleware – chain propagation', () => {
  it('appends requestId to existing chain from header', () => {
    const mw = requestIdMiddleware()
    const req = mockReq({headers: {'x-request-chain': 'id1,id2'}})
    runMw(mw, req)
    assert.equal(req.requestChain[0], 'id1')
    assert.equal(req.requestChain[1], 'id2')
    assert.equal(req.requestChain[2], req.requestId)
  })

  it('handles string[] header', () => {
    const mw = requestIdMiddleware()
    const req = mockReq({headers: {'x-request-chain': ['id1,id2', 'id3']}})
    runMw(mw, req)
    assert.equal(req.requestChain.length, 4)
  })
})

// ─── requestIdMiddleware – maxChainLength ─────────────────────────────────────

describe('requestIdMiddleware – maxChainLength', () => {
  it('limits chain to maxChainLength', () => {
    const mw = requestIdMiddleware({maxChainLength: 3})
    const incoming = Array.from({length: 10}, (_, i) => `id${i}`).join(',')
    const req = mockReq({headers: {'x-request-chain': incoming}})
    runMw(mw, req)
    assert.equal(req.requestChain.length, 1)
  })

  it('maxChainLength: 0 – chain is always empty', () => {
    const mw = requestIdMiddleware({maxChainLength: 0})
    const req = mockReq({headers: {'x-request-chain': 'id1,id2'}})
    runMw(mw, req)
    assert.deepEqual(req.requestChain, [])
  })

  it('maxChainLength: 0 – chain header is not set', () => {
    const mw = requestIdMiddleware({maxChainLength: 0})
    const res = mockRes()
    runMw(mw, mockReq(), res)
    assert.equal(res.headers['x-request-chain'], undefined)
  })
})

// ─── requestIdMiddleware – setResponseHeader ──────────────────────────────────

describe('requestIdMiddleware – setResponseHeader: false', () => {
  it('does not set response headers', () => {
    const mw = requestIdMiddleware({setResponseHeader: false})
    const res = mockRes()
    runMw(mw, mockReq(), res)
    assert.equal(res.headers['x-request-id'], undefined)
    assert.equal(res.headers['x-request-chain'], undefined)
  })
})

// ─── requestIdMiddleware – custom header names ────────────────────────────────

describe('requestIdMiddleware – custom header names', () => {
  it('reads from custom chainHeaderName', () => {
    const mw = requestIdMiddleware({chainHeaderName: 'x-trace'})
    const req = mockReq({headers: {'x-trace': 'id1'}})
    runMw(mw, req)
    assert.equal(req.requestChain[0], 'id1')
  })

  it('writes to custom requestIdHeaderName', () => {
    const mw = requestIdMiddleware({requestIdHeaderName: 'x-my-request-id'})
    const res = mockRes()
    const req = mockReq()
    runMw(mw, req, res)
    assert.equal(res.headers['x-my-request-id'], req.requestId)
  })
})
