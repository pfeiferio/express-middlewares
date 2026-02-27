export type JsonOptions = {
  limit?: string | number
  strict?: boolean
  type?: string | string[]
}

export type UrlEncodedOptions = {
  extended?: boolean
  limit?: string | number
  type?: string | string[]
}

export type RawOptions = {
  limit?: string | number
  type?: string | string[]
}

export type MultipartOptions = {
  multer: typeof import('multer')
  storage?: import('multer').StorageEngine
  fileFilter?: import('multer').Options['fileFilter']
  limits?: import('multer').Options['limits']
}

export type BodyParserOptions = {
  jsonLimit?: number
  multipartLimit?: number
  rawBody?: boolean
  middleware?: {
    json?: JsonOptions | false
    urlencoded?: UrlEncodedOptions | false
    multipart?: MultipartOptions | false
    raw?: RawOptions | false
  }
}
