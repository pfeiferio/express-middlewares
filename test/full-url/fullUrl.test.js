import test, {describe} from 'node:test'
import assert from 'node:assert/strict'
import {fullUrlMiddleware} from '../../dist/full-url/index.js'

describe('fullUrl()', () => {

  const mockReq = (overrides = {}) => ({
    protocol: 'https',
    host: 'example.com',
    originalUrl: '/api/test?foo=bar',
    ...overrides
  })

  const mockRes = () => ({})

  const mockNext = () => {
    let called = false
    const fn = () => {
      called = true
    }
    fn.called = () => called
    return fn
  }

  test('sets req.fullUrl', () => {
    const req = mockReq()
    const next = mockNext()
    fullUrlMiddleware()(req, mockRes(), next)
    assert.equal(req.fullUrl, 'https://example.com/api/test?foo=bar')
  })

  test('sets req.hostUrl', () => {
    const req = mockReq()
    const next = mockNext()
    fullUrlMiddleware()(req, mockRes(), next)
    assert.equal(req.hostUrl, 'https://example.com')
  })

  test('includes port in hostUrl when present', () => {
    const req = mockReq({host: 'example.com:3000'})
    const next = mockNext()
    fullUrlMiddleware()(req, mockRes(), next)
    assert.equal(req.hostUrl, 'https://example.com:3000')
    assert.equal(req.fullUrl, 'https://example.com:3000/api/test?foo=bar')
  })

  test('handles path without query string', () => {
    const req = mockReq({originalUrl: '/api/test'})
    const next = mockNext()
    fullUrlMiddleware()(req, mockRes(), next)
    assert.equal(req.fullUrl, 'https://example.com/api/test')
  })

  test('calls next()', () => {
    const req = mockReq()
    const next = mockNext()
    fullUrlMiddleware()(req, mockRes(), next)
    assert.equal(next.called(), true)
  })

})
