# @pfeiferio/express-middlewares

> A collection of reusable middlewares for Express applications.

[![npm version](https://badge.fury.io/js/%40pfeiferio%2Fexpress-middlewares.svg)](https://www.npmjs.com/package/@pfeiferio/express-middlewares)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![codecov](https://codecov.io/gh/pfeiferio/express-middlewares/branch/main/graph/badge.svg)](https://codecov.io/gh/pfeiferio/express-middlewares)

## Included middlewares

- **accessLogMiddleware** – Flexible HTTP access logging powered by morgan with automatic daily file rotation.
- **bodyParser** – Unified body parsing for JSON, URL-encoded, multipart and raw/text requests.

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
import {accessLogMiddleware, bodyParser} from "@pfeiferio/express-middlewares"

const app = express()

app.use(
  accessLogMiddleware({
    format: "combined",
    output: "file",
    path: "./logs",
    skip: req => req.path === "/health"
  })
)

app.use(bodyParser())
```

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
