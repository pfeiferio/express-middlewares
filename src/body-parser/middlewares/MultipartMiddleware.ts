import type {RequestHandler} from "express";
import type {BodyParserOptions, MultipartOptions} from "../types/types.js";

export function multipartMiddleware(
  middlewares: RequestHandler[],
  _options: BodyParserOptions,
  multipart: MultipartOptions,
) {

  if (!multipart.multer) {
    throw new Error('multipart.multer is required – install multer and pass it via options.')
  }

  const multer = multipart.multer
  const {storage, fileFilter, limits} = multipart

  const multerOptions: Record<string, unknown> = {
    storage: storage ?? multer.memoryStorage(),
    limits
  }

  if (fileFilter) {
    multerOptions.fileFilter = fileFilter
  }

  const upload = multer(multerOptions)

  middlewares.push(upload.any())
  middlewares.push((req, _res, next) => {
    if (Array.isArray(req.files)) {
      req.groupedFiles = req.files.reduce((acc, file) => {
        acc[file.fieldname] ??= []
        acc[file.fieldname]!.push(file)
        return acc
      }, {} as Record<string, Express.Multer.File[]>)
    }
    next()
  })
}
