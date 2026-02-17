# @pfeiferio/express-middlewares

> A collection of reusable middlewares for Express applications.

[![npm version](https://badge.fury.io/js/%40pfeiferio%2Fexpress-middlewares.svg)](https://www.npmjs.com/package/@pfeiferio/express-middlewares)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![codecov](https://codecov.io/gh/pfeiferio/express-middlewares/branch/main/graph/badge.svg)](https://codecov.io/gh/pfeiferio/express-middlewares)

## Included middlewares

- **accessLogMiddleware** – Flexible HTTP access logging powered by morgan with automatic daily file rotation.

---

## Installation

```bash
npm install @pfeiferio/express-middlewares
```

---

## Usage

```js
import express from "express"
import {accessLogMiddleware} from "@pfeiferio/express-middlewares"

const app = express()

app.use(
  accessLogMiddleware({
    format: "combined",
    output: "file",
    path: "./logs",
    skip: req => req.path === "/health"
  })
)
```

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

## Log File Naming

When `output` is set to `"file"`, logs are written as:

```
access_log_YYYY_MM_DD.log
```

Log files rotate automatically per day. You can override the filename with a static string or a dynamic function:

```js
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
