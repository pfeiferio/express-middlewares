import {describe, it} from 'node:test'
import assert from 'node:assert/strict';
import {parseChainString} from '../../dist/request-id/utils/parseChainString.js';
import {INVALID_CHAIN} from "../../dist/request-id/utils/parseChainHeader.js";

describe('Request-Chain Parser', () => {

  it('should parse simple chains correctly', () => {
    assert.deepEqual(parseChainString(30, 3, 'a,b,c'), ['a', 'b', 'c']);
  });

  it('should trim whitespace padding', () => {
    assert.deepEqual(parseChainString(30, 3, ' a , b , c '), ['a', 'b', 'c']);
  });

  it('should return [] for empty IDs (,,)', () => {
    assert.deepEqual(parseChainString(30, 10, 'a,,b'), INVALID_CHAIN);
  });

  it('should return [] for whitespace between commas ( , )', () => {
    assert.deepEqual(parseChainString(30, 10, 'a, ,b'), INVALID_CHAIN);
  });

  it('should return [] for trailing comma with whitespace (a,  )', () => {
    assert.deepEqual(parseChainString(30, 10, 'a,  '), INVALID_CHAIN);
  });

  it('should return [] for leading comma', () => {
    assert.deepEqual(parseChainString(30, 10, ',a,b'), INVALID_CHAIN);
  });

  it('should strictly enforce maxIdLength', () => {
    assert.deepEqual(parseChainString(30, 2, 'abc'), INVALID_CHAIN); // too long
    assert.deepEqual(parseChainString(30, 3, 'abc'), ['abc']); // exactly at limit
  });

  it('should allow IDs with spaces in the middle', () => {
    assert.deepEqual(parseChainString(30, 10, 'ID 1, ID 2'), ['ID 1', 'ID 2']);
  });

  it('should return [] for invalid input types', () => {
    assert.deepEqual(parseChainString(30, 10, null), INVALID_CHAIN);
    assert.deepEqual(parseChainString(30, 10, undefined), INVALID_CHAIN);
    assert.deepEqual(parseChainString(30, 10, ''), INVALID_CHAIN);
  });

  it('should pre-check total length (maxChainLength * maxIdLength)', () => {
    const tooLong = 'a'.repeat(100);
    assert.deepEqual(parseChainString(5, 5, tooLong), INVALID_CHAIN);
  });
});

describe('Comprehensive Request-Chain Validation', (t) => {

  it('standard & whitespace trimming', () => {
    assert.deepEqual(parseChainString(10, 5, 'a,b,c'), ['a', 'b', 'c'], 'simple');
    assert.deepEqual(parseChainString(10, 5, ' a, b, c'), ['a', 'b', 'c'], 'leading space');
    assert.deepEqual(parseChainString(10, 5, 'a ,b ,c '), ['a', 'b', 'c'], 'trailing space per ID');
    assert.deepEqual(parseChainString(10, 10, 'ID 1, ID 2'), ['ID 1', 'ID 2'], 'spaces within ID');
  });

  it('empty elements should return []', () => {
    assert.deepEqual(parseChainString(10, 5, ',a,b'), INVALID_CHAIN, 'leading comma');
    assert.deepEqual(parseChainString(10, 5, 'a,,b'), INVALID_CHAIN, 'double comma');
    assert.deepEqual(parseChainString(10, 5, 'a, ,b'), INVALID_CHAIN, 'space between commas');
    assert.deepEqual(parseChainString(10, 5, 'a,'), INVALID_CHAIN, 'trailing comma');
    assert.deepEqual(parseChainString(10, 5, 'a, '), INVALID_CHAIN, 'trailing comma + space');
    assert.deepEqual(parseChainString(10, 5, ' , '), INVALID_CHAIN, 'only comma and spaces');
    assert.deepEqual(parseChainString(10, 5, ' '), INVALID_CHAIN, 'only a space');
  });

  it('length enforcement (maxIdLength)', () => {
    assert.deepEqual(parseChainString(10, 3, 'abc,de,f'), ['abc', 'de', 'f'], 'exactly at limit');
    assert.deepEqual(parseChainString(10, 3, 'abcd'), INVALID_CHAIN, 'single ID too long');
    assert.deepEqual(parseChainString(10, 3, 'a,abcd,c'), INVALID_CHAIN, 'middle ID too long');
    assert.deepEqual(parseChainString(10, 3, '  abcd  '), INVALID_CHAIN, 'trimmed ID still too long');
    assert.deepEqual(parseChainString(10, 3, 'a, bcd'), ['a', 'bcd'], 'ID with space padding exactly at limit');
  });

  it('chain limit (maxChainLength)', () => {
    assert.deepEqual(parseChainString(3, 5, 'a,b,c'), ['a', 'b', 'c'], 'limit reached');
    assert.deepEqual(parseChainString(2, 5, 'a,b,c'), INVALID_CHAIN, 'limit exceeded');
  });

  it('edge cases & types', () => {
    assert.deepEqual(parseChainString(10, 5, 'a\nb'), INVALID_CHAIN, 'newline should fail');
    assert.deepEqual(parseChainString(10, 5, '\ta,b'), INVALID_CHAIN, 'tab should fail');
    assert.deepEqual(parseChainString(10, 5, 'a, b\r'), INVALID_CHAIN, 'carriage return at end');
    assert.deepEqual(parseChainString(10, 5, 'a, b  c ,d'), ['a', 'b  c', 'd'], 'multiple spaces within ID');
    assert.deepEqual(parseChainString(10, 5, null), INVALID_CHAIN, 'null input');
    assert.deepEqual(parseChainString(10, 5, undefined), INVALID_CHAIN, 'undefined input');
    assert.deepEqual(parseChainString(10, 5, ''), INVALID_CHAIN, 'empty string');
  });

  it('exact boundary check for chainLength', () => {
    const max = 5;
    const inputOk = Array(max).fill('a').join(',');         // "a,a,a,a,a"
    const inputTooLong = Array(max + 1).fill('a').join(','); // "a,a,a,a,a,a"

    assert.strictEqual(parseChainString(max, 1, inputOk).length, max, 'limit exactly met');
    assert.deepEqual(parseChainString(max, 1, inputTooLong), INVALID_CHAIN, 'limit exceeded by one');
  });

  it('security / buffer overflow protection', () => {
    const hugeString = 'a,'.repeat(10000);
    assert.deepEqual(parseChainString(10, 10, hugeString), INVALID_CHAIN, 'massively long string');

    const longId = 'a'.repeat(100);
    assert.deepEqual(parseChainString(10, 5, longId), INVALID_CHAIN, 'single ID massively too long');
  });

  it('should fail when segment after comma contains only spaces', () => {
    assert.strictEqual(parseChainString(30, 10, 'a, '), INVALID_CHAIN);
  });

  it('should fail for string consisting only of spaces', () => {
    assert.strictEqual(parseChainString(30, 10, 'a, '), INVALID_CHAIN);
    assert.strictEqual(parseChainString(2, 1, 'a,a,a,a'), INVALID_CHAIN);
    assert.strictEqual(parseChainString(2, 1, 'a,'), INVALID_CHAIN);
    assert.strictEqual(parseChainString(2, 1, 'a, '), INVALID_CHAIN);
    assert.strictEqual(parseChainString(2, 1, ' a, '), INVALID_CHAIN);
    assert.strictEqual(parseChainString(2, 1, '  a, '), INVALID_CHAIN);
    assert.strictEqual(parseChainString(2, 1, '   a,  '), INVALID_CHAIN);
    assert.strictEqual(parseChainString(2, 1, '   a ,  '), INVALID_CHAIN);
    assert.strictEqual(parseChainString(2, 1, 'a ,  '), INVALID_CHAIN);
    assert.strictEqual(parseChainString(2, 1, 'a , '), INVALID_CHAIN);
    assert.strictEqual(parseChainString(2, 1, ' a , '), INVALID_CHAIN);
  });
});
