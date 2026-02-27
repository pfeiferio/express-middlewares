declare module "express-serve-static-core" {
  interface Request {
    rawBody?: Buffer,
    groupedFiles?: Record<string, Express.Multer.File[]>
  }
}

export {};
