import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import fs, {existsSync, mkdtempSync, rmSync, unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LogStream} from '../../dist/access-log/LogStream.js';

let tmpDir;

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'access-log-test-'));
});

beforeEach(async () => await LogStream.reset())
after(() => {
  rmSync(tmpDir, {recursive: true, force: true});
});

test('LogStream: creates file on instantiation', async () => {
  const logFilePath = join(tmpDir, 'test.log');
  const stream = LogStream.create({logFilePath, createDirectory: false});
  await stream.close();
  assert.ok(existsSync(logFilePath));
})

test('LogStream: creates directory when createDirectory is true', async () => {
  const logFilePath = join(tmpDir, 'subdir', 'test.log');
  const stream = LogStream.create({logFilePath, createDirectory: true});
  await stream.close();
  assert.ok(existsSync(join(tmpDir, 'subdir')));
})

test('LogStream: throws when directory does not exist and createDirectory is false', async () => {
  const logFilePath = join(tmpDir, 'nonexistent', 'test.log');
  assert.throws(() => LogStream.create({logFilePath, createDirectory: false}));
})

test('LogStream: returns same instance for same path', async () => {
  const logFilePath = join(tmpDir, 'singleton.log');
  const a = LogStream.create({logFilePath, createDirectory: false});
  const b = LogStream.create({logFilePath, createDirectory: false});
  await a.close();
  assert.equal(a, b);
})

test('LogStream: writable is null after close', async () => {
  const logFilePath = join(tmpDir, 'closed.log');
  const stream = LogStream.create({logFilePath, createDirectory: false});
  await stream.close();
  assert.equal(stream.writable, null);
})


// remove tests
test('LogStream.remove: removes existing instance', async () => {
  const logFilePath = join(tmpDir, 'remove-existing.log');
  const stream = LogStream.create({logFilePath, createDirectory: false});
  await LogStream.remove(stream);
  // new instance should be created (not same reference)
  const stream2 = LogStream.create({logFilePath, createDirectory: false});
  assert.notEqual(stream, stream2);
  await stream2.close();
});

test('LogStream.remove: handles null gracefully', async () => {
  await assert.doesNotReject(() => Promise.resolve(LogStream.remove(null)));
});

// error handler tests
test('LogStream: recreates stream on ENOENT', async (t) => {
  const logFilePath = join(tmpDir, 'enoent-test.log');
  const stream = LogStream.create({logFilePath, createDirectory: false});

  // delete the file to trigger ENOENT
  await new Promise(resolve => setTimeout(resolve, 100));
  unlinkSync(logFilePath);
  // wait for watcher/recreate to kick in
  await new Promise(resolve => setTimeout(resolve, 100));

  assert.ok(existsSync(logFilePath));
  assert.ok(stream.writable);
  await stream.close();
});


// watcher tests
test('LogStream: recreates stream when file is deleted via watcher', async () => {
  const logFilePath = join(tmpDir, 'watcher-test.log');
  const stream = LogStream.create({logFilePath, createDirectory: false});

  await new Promise(resolve => setTimeout(resolve, 100));
  unlinkSync(logFilePath);
  await new Promise(resolve => setTimeout(resolve, 100));

  await stream.close();
  assert.ok(existsSync(logFilePath));
});

// recreate attempts tests
test('LogStream: stops recreating after maxRecreateAttempts', async () => {
  const logFilePath = join(tmpDir, 'max-attempts.log');
  const stream = LogStream.create({
    logFilePath,
    createDirectory: false,
    maxRecreateAttempts: 2
  });

  await new Promise(r => setTimeout(r, 100));

  try {
    stream.writable.write('test\n');
    await new Promise(resolve => setTimeout(resolve, 100));

    await new Promise(resolve => {
      stream.eventEmitter.once('recreate', resolve);

      (async () => {
        for (let i = 0; i < 3; i++) {
          if (existsSync(logFilePath)) unlinkSync(logFilePath);
          await new Promise(r => setTimeout(r, 100));
        }
      })();
    });
  } finally {
    await stream.close();
  }
});

test('LogStream: resets recreateAttempts on successful recreate', async () => {
  const logFilePath = join(tmpDir, 'reset-attempts.log');
  const stream = LogStream.create({
    logFilePath,
    createDirectory: false,
    maxRecreateAttempts: 2
  });

  try {
    stream.writable.write('test\n');
    await new Promise(resolve => setTimeout(resolve, 100));

    // first recreate - attempts should go to 1 then reset to 0
    await new Promise(resolve => {
      stream.eventEmitter.once('recreate', (attempts) => {
        assert.equal(attempts, 1);
        resolve();
      });
      unlinkSync(logFilePath);
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(stream.recreateAttempts, 0);

    // second recreate - should still work, attempts reset again
    await new Promise(resolve => {
      stream.eventEmitter.once('recreate', (attempts) => {
        assert.equal(attempts, 1);
        resolve();
      });
      unlinkSync(logFilePath);
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(stream.recreateAttempts, 0);
  } finally {
    await stream.close();
  }
});

test('LogStream: recreates stream on ENOENT error', async () => {
  const logFilePath = join(tmpDir, 'enoent-error.log');
  const stream = LogStream.create({logFilePath, createDirectory: false});

  try {
    stream.writable.write('test\n');
    await new Promise(resolve => setTimeout(resolve, 100));

    await new Promise(resolve => {
      stream.eventEmitter.once('recreate', resolve);
      stream.writable.destroy(Object.assign(new Error('ENOENT'), {code: 'ENOENT'}));
    });

    assert.ok(stream.writable);
  } finally {
    await stream.close();
  }
});

test('LogStream: writable returns stream after create', async () => {
  const logFilePath = join(tmpDir, 'writable-test.log');
  const stream = LogStream.create({logFilePath, createDirectory: false});

  try {
    assert.ok(stream.writable);
  } finally {
    await stream.close();
  }
});

test('LogStream: writable returns null after close', async () => {
  const logFilePath = join(tmpDir, 'writable-null-test.log');
  const stream = LogStream.create({logFilePath, createDirectory: false});

  await stream.close();
  assert.equal(stream.writable, null);
});

test('LogStream: stops recreating after maxRecreateAttempts', async () => {
  const subDir = join(tmpDir, 'exhaust-test');

  fs.mkdirSync(subDir);
  const logFilePath = join(subDir, 'test.log');
  const stream = LogStream.create({
    logFilePath,
    createDirectory: false,
    maxRecreateAttempts: 2
  });

  await new Promise(resolve => setTimeout(resolve, 100));

  stream.writable?.write('test\n');

  rmSync(subDir, {recursive: true, force: true});
  stream.writable.destroy({
    code: 'ENOENT'
  })

  stream.destroy()

  await new Promise(resolve => {
    stream.eventEmitter.once('recreateExhausted', resolve);
    stream.writable?.write('test\n');
  });
})
