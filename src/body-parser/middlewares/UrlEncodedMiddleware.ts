import type {BodyParserOptions, UrlEncodedOptions} from "../types/types.js";
import express, {type RequestHandler} from "express";
import {withRawBody} from "../utils/withRawBody.js";

export function urlEncodedMiddleware(
  middlewares: RequestHandler[],
  options: BodyParserOptions,
  urlencoded: UrlEncodedOptions
) {
  middlewares.push(express.urlencoded({extended: false, ...(options.rawBody ? withRawBody(urlencoded) : urlencoded)}))
}
