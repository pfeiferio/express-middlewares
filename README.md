# @pfeiferio/express-middlewares

> A collection of reusable middlewares for Express applications.

[![npm version](https://img.shields.io/npm/v/@pfeiferio/express-middlewares.svg)](https://www.npmjs.com/package/@pfeiferio/express-middlewares)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![codecov](https://codecov.io/gh/pfeiferio/express-middlewares/branch/main/graph/badge.svg)](https://codecov.io/gh/pfeiferio/express-middlewares)

## Included middlewares

- **accessLogMiddleware** – Flexible HTTP access logging powered by morgan with automatic daily file rotation.
- **bodyParser** – Unified body parsing for JSON, URL-encoded, multipart and raw/text requests.
- **gracefulShutdownMiddleware** – Graceful shutdown handling with pending request draining.

---

## Installation

```bash
npm install @pfeiferio/express-middlewares
```

For multipart/form-data support, install multer as well:

```bash
npm install multer
```

---

## Usage

```ts
import express from "express"
import {
  accessLogMiddleware,
  bodyParser,
  gracefulShutdownMiddleware,
  createShutdownSignal,
  requestIdMiddleware
} from "@pfeiferio/express-middlewares"

const app = express()
const signal = createShutdownSignal((sig) => console.log('received', sig))
const server = app.listen(3000)

app.use(
  accessLogMiddleware({
    format: "combined",
    output: "file",
    path: "./logs",
    skip: req => req.path === "/health"
  })
)
app.use(bodyParser())
app.use(gracefulShutdownMiddleware({
  signal,
  onDrain: () => server.close(() => process.exit(0))
}))
app.use(requestIdMiddleware())

```

---

## gracefulShutdownMiddleware

Tracks pending requests and drains them before allowing the process to exit. New incoming requests are rejected once
shutdown is initiated.

### Basic usage

```ts
import {gracefulShutdownMiddleware, createShutdownSignal} from "@pfeiferio/express-middlewares"

const server = app.listen(3000)
const signal = createShutdownSignal()

app.use(gracefulShutdownMiddleware({
  signal,
  onDrain: () => server.close(() => process.exit(0))
}))
```

### Configuration

| Option        | Type                                                              | Default           | Description                                                                               |
|---------------|-------------------------------------------------------------------|-------------------|-------------------------------------------------------------------------------------------|
| `signal`      | `AbortSignal`                                                     | —                 | Required. Use `createShutdownSignal()` or provide your own `AbortController.signal`       |
| `timeout`     | `number`                                                          | `10000`           | Timeout in ms before forced drain. `-1` = immediate, `0` = wait forever, `>0` = wait X ms |
| `onDrain`     | `(info: { pendingRequests: number, isTimeout: boolean }) => void` | —                 | Required. Called when all pending requests are drained or timeout is reached              |
| `onReject`    | `RequestHandler`                                                  | 503 JSON response | Called for every incoming request while shutting down                                     |
| `forceReject` | `boolean`                                                         | `false`           | Forces all requests to be rejected immediately. For testing your `onReject` handler only  |

### createShutdownSignal

Helper that listens to `SIGINT` and `SIGTERM` and returns an `AbortSignal`. After the first signal, all listeners are
removed — a second signal triggers Node's default behavior (hard kill).

```ts
const signal = createShutdownSignal(
  (sig) => console.log('received', sig), // optional callback
  ['SIGINT', 'SIGTERM']                  // optional signals, default: ['SIGINT', 'SIGTERM']
)
```

### Custom onReject

```ts
app.use(gracefulShutdownMiddleware({
  signal,
  onDrain: () => server.close(() => process.exit(0)),
  onReject: (req, res) => res.status(503).json({error: 'server shutting down', retryAfter: 30})
}))
```

### Testing your onReject handler

```ts
app.use(gracefulShutdownMiddleware({
  signal,
  onDrain: () => server.close(() => process.exit(0)),
  onReject: myCustomRejectHandler,
  forceReject: process.env.NODE_ENV === 'test'
}))
```

---

## requestIdMiddleware

Assigns a unique `requestId` to every request and propagates a full request chain across services via HTTP headers.
Also tracks a `correlationId` that is forwarded unchanged through the entire call chain.

### Basic usage

```ts
app.use(requestIdMiddleware())

app.get('/', (req, res) => {
  console.log(req.requestId)     // UUID for this request
  console.log(req.correlationId) // forwarded or newly generated
  console.log(req.requestChain)  // ['svc-a-id', 'svc-b-id', 'this-id']
})
```

### Chain propagation

Each service appends its `requestId` to the `x-request-chain` header. When calling downstream services,
forward the header as-is — the next service will append its own ID:

```
Service A → x-request-chain: id-a
Service B → x-request-chain: id-a,id-b
Service C → x-request-chain: id-a,id-b,id-c
```

This gives you the full hop trace on every request. `req.requestChain.length` tells you how many services
were involved.

### Configuration

| Option                    | Type      | Default             | Description                                                                  |
|---------------------------|-----------|---------------------|------------------------------------------------------------------------------|
| `chainHeaderName`         | `string`  | `x-request-chain`   | Header used to propagate the chain                                           |
| `requestIdHeaderName`     | `string`  | `x-request-id`      | Header used to forward the previous service's request ID into the chain      |
| `correlationIdHeaderName` | `string`  | `x-correlation-id`  | Header used to propagate the correlation ID                                  |
| `setResponseHeader`       | `boolean` | `true`              | Write chain, requestId and correlationId back as response headers            |
| `maxChainLength`          | `number`  | `30`                | Max number of IDs in the chain. `0` disables chain tracking entirely         |
| `maxIdLength`             | `number`  | `64`                | Max length per ID. IDs exceeding this cause the entire chain to be discarded |

### Security

The chain header is strictly validated on every request:

- Only alphanumeric characters, spaces, `-`, `_`, `:` and `#` are allowed
- IDs exceeding `maxIdLength` cause the entire chain to be discarded
- Chains exceeding `maxChainLength` are rejected
- Oversized headers are rejected before parsing
- Malformed input (empty segments, invalid characters, newlines) results in an empty chain

---

## bodyParser

A unified Express middleware wrapper for `json`, `urlencoded`, `multipart/form-data` and `raw/text` body parsing —
including optional `rawBody` support out of the box.

`json` and `urlencoded` are enabled with their defaults when no options are passed. `multipart` and `raw` are opt-in.

### Basic usage

```ts
app.use(bodyParser())
```

### With options

```ts
import multer from "multer"

app.use(bodyParser({
  jsonLimit: 10 * 1024 * 1024,
  multipartLimit: 50 * 1024 * 1024,
  rawBody: true,
  middleware: {
    json: {limit: '1mb'},
    urlencoded: {extended: true},
    multipart: {multer},
    raw: {},
  }
}))
```

### Configuration

| Option                  | Type                         | Default       | Description                                                 |
|-------------------------|------------------------------|---------------|-------------------------------------------------------------|
| `jsonLimit`             | `number \| null`             | `LIMIT_20_MB` | Max request body size for json and urlencoded               |
| `multipartLimit`        | `number \| null`             | `LIMIT_20_MB` | Max file size for multipart uploads                         |
| `rawBody`               | `boolean`                    | `false`       | Attach raw `Buffer` to `req.rawBody`                        |
| `middleware.json`       | `JsonOptions \| false`       | `{}`          | `express.json()` options. Set to `false` to disable         |
| `middleware.urlencoded` | `UrlEncodedOptions \| false` | `{}`          | `express.urlencoded()` options. Set to `false` to disable   |
| `middleware.multipart`  | `MultipartOptions`           | —             | multer options. Omit to disable                             |
| `middleware.raw`        | `RawOptions`                 | —             | `express.raw()` + `express.text()` options. Omit to disable |

### multipart

Multer must be installed and passed explicitly:

```ts
import multer from "multer"

app.use(bodyParser({
  middleware: {
    multipart: {multer}
  }
}))
```

Uploaded files are available on `req.files` (raw multer array) and `req.groupedFiles` (grouped by field name):

```ts
app.post('/upload', (req, res) => {
  console.log(req.groupedFiles)
  // { avatar: [File, File], doc: [File] }
})
```

| Option       | Type                           | Description                                      |
|--------------|--------------------------------|--------------------------------------------------|
| `multer`     | `typeof multer`                | Required. The multer instance to use             |
| `storage`    | `multer.StorageEngine`         | Custom storage engine. Defaults to memoryStorage |
| `fileFilter` | `multer.Options['fileFilter']` | File filter function                             |
| `limits`     | `multer.Options['limits']`     | Upload limits (overridden by `multipartLimit`)   |

### rawBody

When `rawBody: true`, the raw request `Buffer` is attached to `req.rawBody` — useful for webhook signature verification:

```ts
app.use(bodyParser({rawBody: true}))

app.post('/webhook', (req, res) => {
  console.log(req.rawBody) // Buffer
})
```

### Convenience constants

```ts
import {LIMIT_1_MB, LIMIT_10_MB, LIMIT_50_MB} from "@pfeiferio/express-middlewares"

app.use(bodyParser({jsonLimit: LIMIT_10_MB, multipartLimit: LIMIT_50_MB}))
```

Available: `LIMIT_1_MB`, `LIMIT_5_MB`, `LIMIT_10_MB`, `LIMIT_20_MB`, `LIMIT_30_MB`, `LIMIT_40_MB`, `LIMIT_50_MB`,
`LIMIT_60_MB`, `LIMIT_70_MB`, `LIMIT_80_MB`, `LIMIT_90_MB`, `LIMIT_100_MB`.

---

## accessLogMiddleware

Express middleware for HTTP access logging using [morgan](https://www.npmjs.com/package/morgan).

### Configuration

| Option                | Type                                        | Default                     | Description                                                           |
|-----------------------|---------------------------------------------|-----------------------------|-----------------------------------------------------------------------|
| `output`              | `"file" \| "stdout" \| "stderr"`            | `"stdout"`                  | Target output stream                                                  |
| `format`              | `"combined" \| "dev" \| "common" \| "tiny"` | `"dev"`                     | Log format (see morgan documentation)                                 |
| `path`                | `string`                                    | —                           | Directory for log files (required if `output` is `"file"`)            |
| `filename`            | `string \| () => string`                    | `access_log_YYYY_MM_DD.log` | Log filename or a function returning one                              |
| `skip`                | `(req) => boolean`                          | —                           | Optional filter function to skip specific requests                    |
| `enabled`             | `boolean`                                   | `true`                      | Set to `false` to disable logging entirely                            |
| `createDirectory`     | `boolean`                                   | `true`                      | Automatically create the log directory if it does not exist           |
| `maxRecreateAttempts` | `number`                                    | `3`                         | Maximum number of attempts to recreate the log stream after a failure |

---

### Log File Naming

When `output` is set to `"file"`, logs are written as:

```
access_log_YYYY_MM_DD.log
```

Log files rotate automatically per day. You can override the filename with a static string or a dynamic function:

```ts
// static filename
accessLogMiddleware({
  output: "file",
  path: "./logs",
  filename: "app.log"
})

// dynamic filename
accessLogMiddleware({
  output: "file",
  path: "./logs",
  filename: () => `app_${new Date().toISOString().slice(0, 10)}.log`
})
```

---

## Requirements

- Node.js ≥ 18
- Express 4.x or 5.x

---

## License

MIT
