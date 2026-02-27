import type {BodyParserOptions, RawOptions} from "../types/types.js";
import express, {type RequestHandler} from "express";
import {withRawBody} from "../utils/withRawBody.js";

export function rawMiddleware(
  middlewares: RequestHandler[],
  options: BodyParserOptions,
  raw: RawOptions
) {
  middlewares.push(express.raw(options.rawBody ? withRawBody(raw) : raw))
  middlewares.push(express.text(raw))
}
