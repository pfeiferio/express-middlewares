import fs from "fs";
import morgan from "morgan";
import {Writable} from "stream";
import type e from "express";
import {LogStream} from "./LogStream.js";
import {defaultFilename, generateLogPath} from "./generateLogPath.js";

export type AccessLogFilenameFn = () => string
export type AccessLogOptions = {
  path?: string
  format?: "combined" | "dev" | "common" | "tiny"
  /**
   * True if the current request should be skipped
   */
  skip?: (req: e.Request) => boolean
  output?: "file" | "stdout" | "stderr"
  filename?: AccessLogFilenameFn | string
  enabled?: boolean
  createDirectory?: boolean
}

/**
 * Creates an Express middleware for HTTP access logging using morgan.
 * Supports dynamic log file rotation per day, output to stdout/stderr or file, and conditional skipping.
 */
export const accessLogMiddleware = (config?: AccessLogOptions): e.RequestHandler => {

  const finalConfig: Required<Pick<AccessLogOptions, 'output' | 'format' | 'filename'>> & AccessLogOptions = {
    ...config,
    output: config?.output ?? 'stdout',
    format: config?.format ?? 'dev',
    filename: config?.filename ?? defaultFilename,
  }

  const noop: e.RequestHandler = (_req, _res, next) => next();
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

  return morgan(finalConfig.format, {
    stream: proxyStream,
    ...(finalConfig.skip && {skip: finalConfig.skip}),
  })
}
