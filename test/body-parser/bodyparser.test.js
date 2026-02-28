import {describe, it} from 'node:test'
import assert from 'node:assert/strict'

import {
  LIMIT_100_MB,
  LIMIT_10_MB,
  LIMIT_1_MB,
  LIMIT_20_MB,
  LIMIT_30_MB,
  LIMIT_40_MB,
  LIMIT_50_MB,
  LIMIT_5_MB,
  LIMIT_60_MB,
  LIMIT_70_MB,
  LIMIT_80_MB,
  LIMIT_90_MB,
} from '../../dist/body-parser/types/constants.js'
import {bodyParser} from "../../dist/body-parser/index.js";
import {withRawBody} from "../../dist/body-parser/utils/withRawBody.js";
import {runMiddlewares} from "../../dist/body-parser/utils/runMiddlewares.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockReq(overrides = {}) {
  return {headers: {}, body: undefined, rawBody: undefined, files: undefined, groupedFiles: undefined, ...overrides}
}

function mockRes() {
  return {}
}

function runMw(mw, req, res = mockRes()) {
  return new Promise((resolve) => {
    mw(req, res, (err) => resolve({err: err ?? null}))
  })
}

function mockMulter(fakeFiles = []) {
  const factory = (_options) => ({
    any: () => (req, _res, next) => {
      req.files = fakeFiles
      next()
    }
  })
  factory.memoryStorage = () => ({})
  return factory
}

// ─── constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('LIMIT_1_MB', () => assert.equal(LIMIT_1_MB, 1024 * 1024))
  it('LIMIT_5_MB', () => assert.equal(LIMIT_5_MB, 1024 * 1024 * 5))
  it('LIMIT_10_MB', () => assert.equal(LIMIT_10_MB, 1024 * 1024 * 10))
  it('LIMIT_20_MB', () => assert.equal(LIMIT_20_MB, 1024 * 1024 * 20))
  it('LIMIT_30_MB', () => assert.equal(LIMIT_30_MB, 1024 * 1024 * 30))
  it('LIMIT_40_MB', () => assert.equal(LIMIT_40_MB, 1024 * 1024 * 40))
  it('LIMIT_50_MB', () => assert.equal(LIMIT_50_MB, 1024 * 1024 * 50))
  it('LIMIT_60_MB', () => assert.equal(LIMIT_60_MB, 1024 * 1024 * 60))
  it('LIMIT_70_MB', () => assert.equal(LIMIT_70_MB, 1024 * 1024 * 70))
  it('LIMIT_80_MB', () => assert.equal(LIMIT_80_MB, 1024 * 1024 * 80))
  it('LIMIT_90_MB', () => assert.equal(LIMIT_90_MB, 1024 * 1024 * 90))
  it('LIMIT_100_MB', () => assert.equal(LIMIT_100_MB, 1024 * 1024 * 100))
})

// ─── withRawBody ──────────────────────────────────────────────────────────────

describe('withRawBody', () => {
  it('returns object with verify function', () => {
    const result = withRawBody({})
    assert.equal(typeof result.verify, 'function')
  })

  it('merges existing options', () => {
    const result = withRawBody({limit: '1mb', strict: true})
    assert.equal(result.limit, '1mb')
    assert.equal(result.strict, true)
  })

  it('sets req.rawBody from buf', () => {
    const req = mockReq()
    const buf = Buffer.from('hello')
    withRawBody({}).verify(req, mockRes(), buf)
    assert.deepEqual(req.rawBody, buf)
  })

  it('does not overwrite existing req.rawBody', () => {
    const req = mockReq()
    const first = Buffer.from('first')
    const second = Buffer.from('second')
    const opts = withRawBody({})
    opts.verify(req, mockRes(), first)
    opts.verify(req, mockRes(), second)
    assert.deepEqual(req.rawBody, first)
  })
})

// ─── runMiddlewares ───────────────────────────────────────────────────────────

describe('runMiddlewares', () => {
  it('calls next() when no middlewares', async () => {
    const result = await new Promise((resolve) => {
      runMiddlewares([], mockReq(), mockRes(), (err) => resolve(err ?? null))
    })
    assert.equal(result, null)
  })

  it('runs middlewares in order', async () => {
    const order = []
    const mws = [
      (_req, _res, next) => {
        order.push(1);
        next()
      },
      (_req, _res, next) => {
        order.push(2);
        next()
      },
      (_req, _res, next) => {
        order.push(3);
        next()
      },
    ]
    await new Promise((resolve) => runMiddlewares(mws, mockReq(), mockRes(), resolve))
    assert.deepEqual(order, [1, 2, 3])
  })

  it('forwards error from next(err)', async () => {
    const err = new Error('boom')
    const result = await new Promise((resolve) => {
      runMiddlewares([(_req, _res, next) => next(err)], mockReq(), mockRes(), resolve)
    })
    assert.equal(result, err)
  })

  it('forwards error from thrown exception', async () => {
    const err = new Error('thrown')
    const result = await new Promise((resolve) => {
      runMiddlewares([() => {
        throw err
      }], mockReq(), mockRes(), resolve)
    })
    assert.equal(result, err)
  })

  it('does not mutate the original array', async () => {
    const mws = [(_req, _res, next) => next()]
    const copy = [...mws]
    await new Promise((resolve) => runMiddlewares(mws, mockReq(), mockRes(), resolve))
    assert.deepEqual(mws, copy)
  })
})

// ─── bodyParser – conflict checks ────────────────────────────────────────────

describe('bodyParser – conflict checks', () => {
  it('throws when jsonLimit and json.limit are both set', () => {
    assert.throws(
      () => bodyParser({jsonLimit: LIMIT_10_MB, middleware: {json: {limit: '10mb'}}}),
      /jsonLimit.*json\.limit/i,
    )
  })

  it('throws when multipartLimit and multipart.limits.fileSize are both set', () => {
    assert.throws(
      () => bodyParser({
        multipartLimit: LIMIT_50_MB,
        middleware: {multipart: {multer: mockMulter([]), limits: {fileSize: LIMIT_50_MB}}}
      }),
      /multipartLimit.*multipart\.limits\.fileSize/i,
    )
  })

  it('throws when multipart.multer is missing', () => {
    assert.throws(
      () => bodyParser({middleware: {multipart: {}}}),
      /multer.*required/i,
    )
  })
})

// ─── bodyParser – defaults ────────────────────────────────────────────────────

describe('bodyParser – defaults', () => {
  it('calls next() without error for empty request', async () => {
    const {err} = await runMw(bodyParser(), mockReq())
    assert.equal(err, null)
  })

  it('json enabled by default – calls next()', async () => {
    const {err} = await runMw(bodyParser(), mockReq({headers: {'content-type': 'application/json'}}))
    assert.equal(err, null)
  })

  it('urlencoded enabled by default – calls next()', async () => {
    const {err} = await runMw(bodyParser(), mockReq({headers: {'content-type': 'application/x-www-form-urlencoded'}}))
    assert.equal(err, null)
  })

  it('multipart disabled by default – groupedFiles is an object', async () => {
    const req = mockReq({headers: {'content-type': 'multipart/form-data'}})
    await runMw(bodyParser(), req)
    assert.deepEqual(req.groupedFiles, {})
  })

  it('raw disabled by default – calls next()', async () => {
    const {err} = await runMw(bodyParser(), mockReq({headers: {'content-type': 'application/octet-stream'}}))
    assert.equal(err, null)
  })
})

// ─── bodyParser – disable parsers ────────────────────────────────────────────

describe('bodyParser – disable parsers', () => {
  it('json: false – body stays undefined', async () => {
    const req = mockReq({headers: {'content-type': 'application/json'}})
    await runMw(bodyParser({middleware: {json: false}}), req)
    assert.equal(req.body, undefined)
  })

  it('urlencoded: false – calls next()', async () => {
    const req = mockReq({headers: {'content-type': 'application/x-www-form-urlencoded'}})
    const {err} = await runMw(bodyParser({middleware: {urlencoded: false}}), req)
    assert.equal(err, null)
  })
})

// ─── bodyParser – limits ──────────────────────────────────────────────────────

describe('bodyParser – limits', () => {
  it('accepts jsonLimit without error', () => {
    assert.doesNotThrow(() => bodyParser({jsonLimit: LIMIT_10_MB}))
  })

  it('accepts json.limit without error', () => {
    assert.doesNotThrow(() => bodyParser({middleware: {json: {limit: '10mb'}}}))
  })

  it('accepts multipartLimit without error', () => {
    assert.doesNotThrow(() => bodyParser({
      multipartLimit: LIMIT_50_MB,
      middleware: {multipart: {multer: mockMulter([])}}
    }))
  })

  it('jsonLimit null – no limit applied', () => {
    assert.doesNotThrow(() => bodyParser({jsonLimit: null, middleware: {json: {}}}))
  })

  it('multipartLimit null – no limit applied', () => {
    assert.doesNotThrow(() => bodyParser({multipartLimit: null, middleware: {multipart: {multer: mockMulter([])}}}))
  })
})

// ─── multipartMiddleware – groupedFiles ──────────────────────────────────────

describe('multipartMiddleware – groupedFiles', () => {
  it('groups files by fieldname into req.groupedFiles', async () => {
    const fakeFiles = [
      {fieldname: 'avatar', originalname: 'a.jpg'},
      {fieldname: 'avatar', originalname: 'b.jpg'},
      {fieldname: 'doc', originalname: 'c.pdf'},
    ]

    const req = mockReq()
    const mw = bodyParser({
      middleware: {
        multipart: {
          multer: mockMulter(fakeFiles),
          storage: {},
        }
      },
    })

    await runMw(mw, req)

    assert.equal(req.groupedFiles['avatar'].length, 2)
    assert.equal(req.groupedFiles['doc'].length, 1)
  })

  it('does not fill groupedFiles when req.files is not an array', async () => {
    const req = mockReq()
    const mw = bodyParser({
      middleware: {
        multipart: {
          multer: mockMulter(undefined)
        }
      },
    })

    await runMw(mw, req)

    assert.deepEqual(req.groupedFiles, {})
  })
})

// ─── rawBody branches ─────────────────────────────────────────────────────────

describe('bodyParser – rawBody', () => {
  it('json – rawBody: true – calls next()', async () => {
    const {err} = await runMw(
      bodyParser({rawBody: true}),
      mockReq({headers: {'content-type': 'application/json'}}),
    )
    assert.equal(err, null)
  })

  it('urlencoded – rawBody: true – calls next()', async () => {
    const {err} = await runMw(
      bodyParser({rawBody: true}),
      mockReq({headers: {'content-type': 'application/x-www-form-urlencoded'}}),
    )
    assert.equal(err, null)
  })

  it('raw – rawBody: true – calls next()', async () => {
    const {err} = await runMw(
      bodyParser({rawBody: true, middleware: {raw: {}}}),
      mockReq({headers: {'content-type': 'application/octet-stream'}}),
    )
    assert.equal(err, null)
  })
})

// ─── raw middleware ───────────────────────────────────────────────────────────

describe('bodyParser – raw enabled', () => {
  it('raw: {} – calls next()', async () => {
    const {err} = await runMw(
      bodyParser({middleware: {raw: {}}}),
      mockReq({headers: {'content-type': 'application/octet-stream'}}),
    )
    assert.equal(err, null)
  })

  it('raw: {} with rawBody: false – calls next()', async () => {
    const {err} = await runMw(
      bodyParser({rawBody: false, middleware: {raw: {}}}),
      mockReq({headers: {'content-type': 'application/octet-stream'}}),
    )
    assert.equal(err, null)
  })
})

// ─── multipart fileFilter ─────────────────────────────────────────────────────

describe('multipartMiddleware – fileFilter', () => {
  it('passes fileFilter to multer', async () => {
    const fileFilter = (_req, _file, cb) => cb(null, true)
    const req = mockReq()
    const mw = bodyParser({
      middleware: {
        multipart: {
          multer: mockMulter([]),
          fileFilter,
        }
      },
    })

    const {err} = await runMw(mw, req)
    assert.equal(err, null)
  })
})
