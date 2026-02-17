import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultFilename, generateLogPath} from '../dist/access-log/generateLogPath.js';

test('generateLogPath: throws when filename is empty', () => {
  assert.throws(
    () => generateLogPath(() => '', '/some/path'),
    {message: 'accessLogMiddleware: filename must not be empty'}
  );
});

test('generateLogPath: joins basePath and filename', () => {
  const result = generateLogPath(() => 'access.log', '/var/log');
  assert.equal(result, '/var/log/access.log');
});

test('defaultFilename: returns filename with current date', () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  const expected = `access_log_${now.getFullYear()}_${month}_${date}.log`;

  assert.equal(defaultFilename(), expected);
});
