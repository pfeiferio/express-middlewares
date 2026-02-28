import {describe, it} from 'node:test'
import assert from 'node:assert/strict'

import {requestIdMiddleware} from '../../dist/request-id/index.js'
import {validatedOptions} from '../../dist/request-id/utils/validatedOptions.js'
import {validatedIncomingId} from '../../dist/request-id/utils/validatedIncomingRequestId.js'
import {parseChainHeader} from '../../dist/request-id/utils/parseChainHeader.js'

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

const defaults = {
  correlationIdHeaderName: 'x-correlation-id',
  requestIdHeaderName: 'x-request-id',
  chainHeaderName: 'x-request-chain',
  setResponseHeader: true,
  maxChainLength: 30,
  maxIdLength: 64,
}

// ─── validatedIncomingRequestId ───────────────────────────────────────────────

describe('validatedIncomingId', () => {
  it('returns undefined for undefined input', () => {
    assert.equal(validatedIncomingId(64, undefined), undefined)
  })

  it('returns undefined for empty string', () => {
    assert.equal(validatedIncomingId(64, ''), undefined)
  })

  it('returns undefined for whitespace only', () => {
    assert.equal(validatedIncomingId(64, '   '), undefined)
  })

  it('returns trimmed string for valid input', () => {
    assert.equal(validatedIncomingId(64, '  abc  '), 'abc')
  })

  it('returns undefined when string exceeds maxIdLength', () => {
    assert.equal(validatedIncomingId(3, 'abcd'), undefined)
  })

  it('returns value when string equals maxIdLength', () => {
    assert.equal(validatedIncomingId(3, 'abc'), 'abc')
  })

  it('returns undefined for string[] with length > 1', () => {
    assert.equal(validatedIncomingId(64, ['id1', 'id2']), undefined)
  })

  it('returns value for string[] with length === 1', () => {
    assert.equal(validatedIncomingId(64, ['abc']), 'abc')
  })

  it('returns undefined for empty array element', () => {
    assert.equal(validatedIncomingId(64, ['']), undefined)
  })

  it('returns undefined for array element exceeding maxIdLength', () => {
    assert.equal(validatedIncomingId(3, ['abcd']), undefined)
  })
})

// ─── validatedOptions – missing branches ─────────────────────────────────────

describe('validatedOptions – correlationIdHeaderName', () => {
  it('throws when correlationIdHeaderName is empty string', () => {
    assert.throws(
      () => validatedOptions({correlationIdHeaderName: ''}, defaults),
      /correlationIdHeaderName must be a non-empty string/
    )
  })

  it('throws when correlationIdHeaderName is not a string', () => {
    assert.throws(
      () => validatedOptions({correlationIdHeaderName: 123}, defaults),
      /correlationIdHeaderName must be a non-empty string/
    )
  })
})

describe('validatedOptions – maxIdLength', () => {
  it('throws when maxIdLength is not a number', () => {
    assert.throws(
      () => validatedOptions({maxIdLength: 'abc'}, defaults),
      /maxIdLength must be a number/
    )
  })

  it('throws when maxIdLength is negative', () => {
    assert.throws(
      () => validatedOptions({maxIdLength: -1}, defaults),
      /maxIdLength must be a number/
    )
  })

  it('throws when maxIdLength is a float', () => {
    assert.throws(
      () => validatedOptions({maxIdLength: 1.5}, defaults),
      /maxIdLength must be a number/
    )
  })

  it('accepts maxIdLength: 0', () => {
    assert.doesNotThrow(() => validatedOptions({maxIdLength: 0}, defaults))
  })
})

// ─── parseChainHeader – string[] exceeds maxChainLength ──────────────────────

describe('parseChainHeader – string[] branch', () => {
  it('returns [] when combined string[] chain exceeds maxChainLength', () => {
    const result = parseChainHeader(3, 5, ['a,b,c', 'd'])
    assert.deepEqual(result, [])
  })
})

// ─── requestIdMiddleware – correlationId ──────────────────────────────────────

describe('requestIdMiddleware – correlationId', () => {
  it('sets req.correlationId', () => {
    const mw = requestIdMiddleware()
    const req = mockReq()
    runMw(mw, req)
    assert.match(req.correlationId, /^[0-9a-f-]{36}$/)
  })

  it('propagates incoming correlationId from header', () => {
    const mw = requestIdMiddleware()
    const req = mockReq({headers: {'x-correlation-id': 'corr-123'}})
    runMw(mw, req)
    assert.equal(req.correlationId, 'corr-123')
  })

  it('generates new correlationId when header is missing', () => {
    const mw = requestIdMiddleware()
    const req = mockReq()
    runMw(mw, req)
    assert.match(req.correlationId, /^[0-9a-f-]{36}$/)
  })

  it('sets correlationId response header', () => {
    const mw = requestIdMiddleware()
    const res = mockRes()
    const req = mockReq()
    runMw(mw, req, res)
    assert.equal(res.headers['x-correlation-id'], req.correlationId)
  })

  it('sets res.locals.correlationId', () => {
    const mw = requestIdMiddleware()
    const req = mockReq()
    const res = mockRes()
    runMw(mw, req, res)
    assert.equal(res.locals.correlationId, req.correlationId)
  })
})

// ─── requestIdMiddleware – incomingRequestId already in chain ─────────────────

describe('requestIdMiddleware – incomingRequestId dedup', () => {
  it('does not push incomingRequestId if already last in chain', () => {
    const mw = requestIdMiddleware()
    const incomingId = 'existing-id'
    const req = mockReq({
      headers: {
        'x-request-chain': `prev,${incomingId}`,
        'x-request-id': incomingId
      }
    })
    runMw(mw, req)
    const chain = req.requestChain
    const occurrences = chain.filter(id => id === incomingId).length
    assert.equal(occurrences, 1)
  })

  it('pushes incomingRequestId if not last in chain', () => {
    const mw = requestIdMiddleware()
    const incomingId = 'incoming-id'
    const req = mockReq({
      headers: {
        'x-request-chain': 'prev,other',
        'x-request-id': incomingId
      }
    })
    runMw(mw, req)
    assert.ok(req.requestChain.includes(incomingId))
  })

  it('slices chain when it exceeds maxChainLength after push', () => {
    const mw = requestIdMiddleware({maxChainLength: 3, maxIdLength: 10})
    const incoming = 'a,b'
    const req = mockReq({
      headers: {
        'x-request-chain': incoming,
        'x-request-id': 'c'
      }
    })
    runMw(mw, req)
    assert.equal(req.requestChain.length, 3)
  })
})
