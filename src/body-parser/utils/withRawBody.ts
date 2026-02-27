import type {Request, Response} from "express";

export function withRawBody(options: Record<string, unknown>): Record<string, unknown> {
  return {
    ...options,
    verify: (req: Request, _res: Response, buf: Buffer) => {
      req.rawBody ??= buf
    }
  }
}
