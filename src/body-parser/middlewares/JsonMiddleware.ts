import type {BodyParserOptions, JsonOptions} from "../types/types.js";
import express, {type RequestHandler} from "express";
import {withRawBody} from "../utils/withRawBody.js";

export function jsonMiddleware(
  middlewares: RequestHandler[],
  options: BodyParserOptions,
  json: JsonOptions
) {
  middlewares.push(express.json(options.rawBody ? withRawBody(json) : json))
}
