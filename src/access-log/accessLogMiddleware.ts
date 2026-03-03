import fs from "fs";
import morgan, {type FormatFn} from "morgan";
import {Writable} from "stream";
import type {Request, RequestHandler, Response} from "express";
import {LogStream} from "./LogStream.js";
import {defaultFilename, generateLogPath} from "./generateLogPath.js";

export type AccessLogFilenameFn = () => string
export type AccessLogOptions = {
  path?: string
  format?: "combined" | "dev" | "common" | "tiny"
  /**
   * True if the current request should be skipped
   */
  skip?: (req: Request) => boolean
  output?: "file" | "stdout" | "stderr"
  filename?: AccessLogFilenameFn | string
  enabled?: boolean
  createDirectory?: boolean
  includeRequestId?: boolean
  includeCorrelationId?: boolean
  maxRecreateAttempts?: number
}

/**
 * Creates an Express middleware for HTTP access logging using morgan.
 * Supports dynamic log file rotation per day, output to stdout/stderr or file, and conditional skipping.
 */
export const accessLogMiddleware = (config?: AccessLogOptions): RequestHandler => {

  const finalConfig: Required<Pick<AccessLogOptions, 'output' | 'format' | 'filename'>> & AccessLogOptions = {
    ...config,
    output: config?.output ?? 'stdout',
    format: config?.format ?? 'dev',
    filename: config?.filename ?? defaultFilename,
  }

  const noop: RequestHandler = (_req, _res, next) => next();
  if (finalConfig.enabled === false) return noop;

  const resolvedFilename =
    typeof finalConfig.filename === 'string' ?
      (): string => finalConfig.filename as string
      : finalConfig.filename

  let currentLogStream: LogStream | null = null;

  const selectLogStream = (): NodeJS.WriteStream | fs.WriteStream | null => {
    if (finalConfig.output === "stdout") return process.stdout;
    if (finalConfig.output === "stderr") return process.stderr;
    if (finalConfig?.output !== "file" || !finalConfig?.path) {
      throw new Error('accessLogMiddleware: config.path is required when output="file"');
    }

    const path = generateLogPath(resolvedFilename, finalConfig.path);
    const newLogStream = LogStream.create({
      logFilePath: path,
      maxRecreateAttempts: finalConfig.maxRecreateAttempts,
      createDirectory: finalConfig.createDirectory !== false
    });

    if (newLogStream !== currentLogStream) {
      LogStream.remove(currentLogStream);
      currentLogStream = newLogStream;
    }

    return currentLogStream.writable;
  };

  selectLogStream(); // initialize once

  const proxyStream = new Writable({
    write(chunk, encoding, callback) {
      const accessLogStream = selectLogStream();
      if (!accessLogStream?.writable) return callback();
      const canContinue = (accessLogStream as fs.WriteStream).write(chunk, encoding);

      if (!canContinue) {
        accessLogStream.once("drain", callback);
      } else {
        callback();
      }
    },
  });

  if (finalConfig.includeCorrelationId) {
    morgan.token('correlation-id', (req: Request) => req.correlationId ?? '-')
  }
  if (finalConfig.includeRequestId) {
    morgan.token('request-id', (req: Request) => req.requestId ?? '-')
  }

  let formatName: string = finalConfig.format
  const morganFormat = (morgan as any)[formatName] as (undefined | FormatFn<Request, Response> | string)

  if (morganFormat && (
    finalConfig.includeRequestId
    || finalConfig.includeCorrelationId
  )) {
    formatName = `__custom_${finalConfig.format}_${finalConfig.includeRequestId ? 'rid' : ''}_${finalConfig.includeCorrelationId ? 'cid' : ''}`
    const finalFormat = extendMorganFormat(
      morganFormat,
      finalConfig.includeRequestId ?? true,
      finalConfig.includeCorrelationId ?? true
    )

    morgan.format(formatName, finalFormat as any)
  }

  return morgan(formatName, {
    stream: proxyStream,
    ...(finalConfig.skip && {skip: finalConfig.skip}),
  })
}

export function extendMorganFormat(
  morganFormat: FormatFn<Request, Response> | string,
  showRequestId: boolean,
  showCorrelationId: boolean
): FormatFn<Request, Response> | string {

  if (typeof morganFormat === 'function') {
    const t = morganFormat
    morganFormat = (tokens, req, res) => {
      return [
        t(tokens, req, res),
        showRequestId && `rid:${req.requestId}`,
        showCorrelationId && `cid:${req.correlationId}`
      ].filter(Boolean).join(' ')
    }
  } else {

    if (showRequestId) {
      morganFormat = `${morganFormat} rid::requestId`
      morgan.token('requestId', (req: Request) => req.requestId)
    }
    if (showCorrelationId) {
      morganFormat = `${morganFormat} cid::correlationId`
      morgan.token('correlationId', (req: Request) => req.correlationId)
    }
  }

  return morganFormat as any
}
