import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readdirSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {accessLogMiddleware} from '../dist/access-log/accessLogMiddleware.js';
import {LogStream} from '../dist/access-log/LogStream.js';

let tmpDir;

const mockReq = {headers: {}, method: 'GET', url: '/'};
const mockRes = {
  getHeader: () => {
  },
  setHeader: () => {
  },
  end: function() {
    this.emit('finish');
  },
  on: function(event, cb) { /* store listeners */
  },
  emit: function(event) { /* call stored listeners */
  },
  statusCode: 200
};

const mockNext = () => {
};

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'access-log-middleware-test-'));
});

after(() => {
  rmSync(tmpDir, {recursive: true, force: true});
  LogStream.reset()
});

beforeEach(() => {
  LogStream.reset();
});

test('accessLogMiddleware: returns noop when enabled is false', async () => {
  const middleware = accessLogMiddleware({enabled: false});
  let nextCalled = false;
  middleware(mockReq, mockRes, () => {
    nextCalled = true;
  });
  assert.ok(nextCalled);
});

test('accessLogMiddleware: throws when output is file but path is missing', () => {
  assert.throws(
    () => accessLogMiddleware({output: 'file'}),
    {message: 'accessLogMiddleware: config.path is required when output="file"'}
  );
});

test('accessLogMiddleware: writes to stdout', async () => {
  let output = '';
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    output += chunk;
    return true;
  };

  try {
    const middleware = accessLogMiddleware({output: 'stdout'});
    await new Promise(resolve => {
      middleware(mockReq, mockRes, resolve);
    });
    mockRes.end()
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.ok(output.length > 0);
  } finally {
    process.stdout.write = originalWrite;
  }
});

test('accessLogMiddleware: writes to stderr', async () => {
  let output = '';
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk) => {
    output += chunk;
    return true;
  };

  try {
    const middleware = accessLogMiddleware({output: 'stderr'});
    await new Promise(resolve => {
      middleware(mockReq, mockRes, resolve);
    });
    mockRes.end()
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.ok(output.length > 0);
  } finally {
    process.stderr.write = originalWrite;
  }
});

test('accessLogMiddleware: writes to file', async () => {
  const logDir = join(tmpDir, 'middleware-file-test');
  const middleware = accessLogMiddleware({output: 'file', path: logDir});

  await new Promise(resolve => {
    middleware(mockReq, mockRes, resolve);
  });

  mockRes.end()
  await new Promise(resolve => setTimeout(resolve, 100))
  const files = readdirSync(logDir);
  assert.ok(files.length > 0);
  assert.ok(readFileSync(join(logDir, files[0]), 'utf-8').length > 0);
});

test('accessLogMiddleware: skips request when skip returns true', async () => {
  let output = '';
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    output += chunk;
    return true;
  };

  try {
    const middleware = accessLogMiddleware({
      output: 'stdout',
      skip: () => true
    });
    await new Promise(resolve => {
      middleware(mockReq, mockRes, resolve);
    });
    assert.equal(output, '');
  } finally {
    process.stdout.write = originalWrite;
  }
});

test('accessLogMiddleware: accepts string filename', async () => {
  const logDir = join(tmpDir, 'string-filename-test');
  const middleware = accessLogMiddleware({
    output: 'file',
    path: logDir,
    filename: 'custom.log'
  });

  await new Promise(resolve => setTimeout(resolve, 100))

  // request durchjagen
  // prüfen ob custom.log existiert
  assert.ok(existsSync(join(logDir, 'custom.log')));
});


test('accessLogMiddleware: handles backpressure', async () => {
  let output = '';
  const originalWrite = process.stdout.write.bind(process.stdout);

  // write gibt false zurück um backpressure zu simulieren
  let drainCallback;
  process.stdout.write = (chunk, encoding, cb) => {
    output += chunk;
    drainCallback = cb;
    return false;
  };

  try {
    const middleware = accessLogMiddleware({output: 'stdout'});
    const writePromise = new Promise(resolve => {
      middleware(mockReq, mockRes, resolve);
    });

    // drain manuell triggern
    process.stdout.emit('drain');
    await writePromise;
    mockRes.end()
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.ok(output.length > 0);
  } finally {
    process.stdout.write = originalWrite;
  }
});

test('accessLogMiddleware: calls callback when stream is not writable', async () => {
  const logDir = join(tmpDir, 'not-writable-test');
  const middleware = accessLogMiddleware({output: 'file', path: logDir});

  // LogStream schließen damit writable null ist
  LogStream.reset();

  let nextCalled = false;
  await new Promise(resolve => {
    middleware(mockReq, mockRes, () => {
      nextCalled = true;
      resolve();
    });
  });

  assert.ok(nextCalled);
});
