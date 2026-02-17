import {join} from "node:path";

export const generateLogPath =
  (filenameResolver: () => string, basePath: string): string => {
    const filename = filenameResolver()
    if (!filename) {
      throw new Error('accessLogMiddleware: filename must not be empty');
    }

    return join(basePath, filename);
  }

export const defaultFilename = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  return `access_log_${now.getFullYear()}_${month}_${date}.log`;
}
