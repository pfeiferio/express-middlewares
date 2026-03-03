declare module "express-serve-static-core" {
  interface Request {
    fullUrl: string
    hostUrl: string
  }
}

export {};
