import {describe, test} from 'node:test';
import assert from 'node:assert/strict';
import {accessLogMiddleware, extendMorganFormat} from "../../dist/access-log/accessLogMiddleware.js";
import morgan from 'morgan'

describe('extendMorganFormat()', () => {

  const mockReq = (overrides = {}) => ({
    requestId: 'abc',
    correlationId: 'xyz',
    ...overrides
  })

  const mockRes = () => ({})
  const mockTokens = {}

  test('appends rid to string format', () => {
    const result = extendMorganFormat(':method :url', true, false)
    assert.equal(result, ':method :url rid::requestId')
  })

  test('appends cid to string format', () => {
    const result = extendMorganFormat(':method :url', false, true)
    assert.equal(result, ':method :url cid::correlationId')
  })

  test('appends both to string format', () => {
    const result = extendMorganFormat(':method :url', true, true)
    assert.equal(result, ':method :url rid::requestId cid::correlationId')
  })

  test('wraps function format and appends rid', () => {
    const base = () => 'GET /test'
    const result = extendMorganFormat(base, true, false)
    assert.equal(result(mockTokens, mockReq(), mockRes()), 'GET /test rid:abc')
  })

  test('wraps function format and appends cid', () => {
    const base = () => 'GET /test'
    const result = extendMorganFormat(base, false, true)
    assert.equal(result(mockTokens, mockReq(), mockRes()), 'GET /test cid:xyz')
  })

  test('wraps function format and appends both', () => {
    const base = () => 'GET /test'
    const result = extendMorganFormat(base, true, true)
    assert.equal(result(mockTokens, mockReq(), mockRes()), 'GET /test rid:abc cid:xyz')
  })
  test('registers custom morgan format when includeRequestId is true', () => {
    accessLogMiddleware({includeRequestId: true})
    assert.ok(morgan['__custom_dev_rid_'])
  })

  test('registers custom morgan format when includeCorrelationId is true', () => {
    accessLogMiddleware({includeCorrelationId: true})
    assert.ok(morgan['__custom_dev__cid'])
  })

  test('registers custom morgan format when both are true', () => {
    accessLogMiddleware({includeRequestId: true, includeCorrelationId: true})
    assert.ok(morgan['__custom_dev_rid_cid'])
  })

  test('does not register custom format when neither is set', () => {
    accessLogMiddleware({})
    assert.equal(morgan['__custom_dev__'], undefined)
  })
})
