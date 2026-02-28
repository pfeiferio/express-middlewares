import {describe, it} from 'node:test'
import assert from 'node:assert/strict';
import {parseChainHeader} from '../../dist/request-id/utils/parseChainHeader.js';
import {validatedIncomingId} from "../../dist/request-id/utils/validatedIncomingRequestId.js";

describe('Request-Chain Parser', () => {

  it('should parse simple chains correctly', () => {
    assert.deepEqual(parseChainHeader(30, 3, 'a,b,c'), ['a', 'b', 'c']);
  });

  it('should trim whitespace padding', () => {
    assert.deepEqual(parseChainHeader(30, 3, ' a , b , c '), ['a', 'b', 'c']);
  });

  it('should return [] for empty IDs (,,)', () => {
    assert.deepEqual(parseChainHeader(30, 10, 'a,,b'), []);
  });

  it('parses string[] header', () => {
    const result = parseChainHeader(30, 5, ['id1,id2', 'id3'])
    assert.deepEqual(result, ['id1', 'id2', 'id3'])
  })

  it('should return [] for whitespace between commas ( , )', () => {
    assert.deepEqual(parseChainHeader(30, 10, 'a, ,b'), []);
  });

  it('should return [] for trailing comma with whitespace (a,  )', () => {
    assert.deepEqual(parseChainHeader(30, 10, 'a,  '), []);
  });

  it('should return [] for leading comma', () => {
    assert.deepEqual(parseChainHeader(30, 10, ',a,b'), []);
  });

  it('should strictly enforce maxIdLength', () => {
    assert.deepEqual(parseChainHeader(30, 2, 'abc'), []); // too long
    assert.deepEqual(parseChainHeader(30, 3, 'abc'), ['abc']); // exactly at limit
  });

  it('should allow IDs with spaces in the middle', () => {
    assert.deepEqual(parseChainHeader(30, 10, 'ID 1, ID 2'), ['ID 1', 'ID 2']);
  });

  it('should return [] for invalid input types', () => {
    assert.deepEqual(parseChainHeader(30, 10, null), []);
    assert.deepEqual(parseChainHeader(30, 10, undefined), []);
    assert.deepEqual(parseChainHeader(30, 10, ''), []);
  });

  it('should pre-check total length (maxChainLength * maxIdLength)', () => {
    const tooLong = 'a'.repeat(100);
    assert.deepEqual(parseChainHeader(5, 5, tooLong), []);
  });
});

describe('Comprehensive Request-Chain Validation', (t) => {

  it('standard & whitespace trimming', () => {
    assert.deepEqual(parseChainHeader(10, 5, 'a,b,c'), ['a', 'b', 'c'], 'simple');
    assert.deepEqual(parseChainHeader(10, 5, ' a, b, c'), ['a', 'b', 'c'], 'leading space');
    assert.deepEqual(parseChainHeader(10, 5, 'a ,b ,c '), ['a', 'b', 'c'], 'trailing space per ID');
    assert.deepEqual(parseChainHeader(10, 10, 'ID 1, ID 2'), ['ID 1', 'ID 2'], 'spaces within ID');
  });

  it('empty elements should return []', () => {
    assert.deepEqual(parseChainHeader(10, 5, ',a,b'), [], 'leading comma');
    assert.deepEqual(parseChainHeader(10, 5, 'a,,b'), [], 'double comma');
    assert.deepEqual(parseChainHeader(10, 5, 'a, ,b'), [], 'space between commas');
    assert.deepEqual(parseChainHeader(10, 5, 'a,'), [], 'trailing comma');
    assert.deepEqual(parseChainHeader(10, 5, 'a, '), [], 'trailing comma + space');
    assert.deepEqual(parseChainHeader(10, 5, ' , '), [], 'only comma and spaces');
    assert.deepEqual(parseChainHeader(10, 5, ' '), [], 'only a space');
  });

  it('length enforcement (maxIdLength)', () => {
    assert.deepEqual(parseChainHeader(10, 3, 'abc,de,f'), ['abc', 'de', 'f'], 'exactly at limit');
    assert.deepEqual(parseChainHeader(10, 3, 'abcd'), [], 'single ID too long');
    assert.deepEqual(parseChainHeader(10, 3, 'a,abcd,c'), [], 'middle ID too long');
    assert.deepEqual(parseChainHeader(10, 3, '  abcd  '), [], 'trimmed ID still too long');
    assert.deepEqual(parseChainHeader(10, 3, 'a, bcd'), ['a', 'bcd'], 'ID with space padding exactly at limit');
  });

  it('chain limit (maxChainLength)', () => {
    assert.deepEqual(parseChainHeader(3, 5, 'a,b,c'), ['a', 'b', 'c'], 'limit reached');
    assert.deepEqual(parseChainHeader(2, 5, 'a,b,c'), [], 'limit exceeded');
  });

  it('edge cases & types', () => {
    assert.deepEqual(parseChainHeader(10, 5, 'a\nb'), [], 'newline should fail');
    assert.deepEqual(parseChainHeader(10, 5, '\ta,b'), [], 'tab should fail');
    assert.deepEqual(parseChainHeader(10, 5, 'a, b\r'), [], 'carriage return at end');
    assert.deepEqual(parseChainHeader(10, 5, 'a, b  c ,d'), ['a', 'b  c', 'd'], 'multiple spaces within ID');
    assert.deepEqual(parseChainHeader(10, 5, null), [], 'null input');
    assert.deepEqual(parseChainHeader(10, 5, undefined), [], 'undefined input');
    assert.deepEqual(parseChainHeader(10, 5, ''), [], 'empty string');
  });

  it('exact boundary check for chainLength', () => {
    const max = 5;
    const inputOk = Array(max).fill('a').join(',');         // "a,a,a,a,a"
    const inputTooLong = Array(max + 1).fill('a').join(','); // "a,a,a,a,a,a"

    assert.strictEqual(parseChainHeader(max, 1, inputOk).length, max, 'limit exactly met');
    assert.deepEqual(parseChainHeader(max, 1, inputTooLong), [], 'limit exceeded by one');
  });

  it('security / buffer overflow protection', () => {
    const hugeString = 'a,'.repeat(10000);
    assert.deepEqual(parseChainHeader(10, 10, hugeString), [], 'massively long string');

    const longId = 'a'.repeat(100);
    assert.deepEqual(parseChainHeader(10, 5, longId), [], 'single ID massively too long');
  });
  it('should return [] if the sum of multiple headers exceeds maxChainLength', () => {
    const headers = ['a,b,c', 'd,e,f'];
    assert.deepEqual(parseChainHeader(5, 10, headers), []);
  });

  it('should return [] if any single header in the array is an INVALID_CHAIN', () => {
    const headers = ['a,b', 'c,,d'];
    assert.deepEqual(parseChainHeader(10, 10, headers), []);
  });

  it('should successfully merge multiple valid headers into one chain', () => {
    const headers = ['a,b', ' c ', 'd,e'];
    assert.deepEqual(parseChainHeader(10, 10, headers), ['a', 'b', 'c', 'd', 'e']);
  });

  it('should return undefined if the ID contains a comma', () => {
    assert.strictEqual(validatedIncomingId(10, 'abc,d'), undefined);
  });

  it('should return undefined if idRegexCheck fails', () => {
    assert.strictEqual(validatedIncomingId(10, 'id<script>'), undefined);
    assert.strictEqual(validatedIncomingId(10, 'id;drop'), undefined);
  });
});
