import fs from "fs";
import {basename, dirname} from "node:path";
import EventEmitter from "node:events";

export type LogStreamOptions = {
  logFilePath: string
  createDirectory: boolean
  maxRecreateAttempts?: number
}

export class LogStream {
  static #instances: Record<string, LogStream> = {};


  static readonly #defaultMaxRecreateAttempts: number = 3;

  readonly #maxRecreateAttempts: number = 0;

  #recreateAttempts: number = 0;

  #watcher: fs.FSWatcher | null = null;

  #stream: fs.WriteStream | null = null;

  readonly #createDirectory: boolean = true

  readonly #logFilePath: string;

  constructor(options: LogStreamOptions) {
    this.#logFilePath = options.logFilePath;
    this.#createDirectory = options.createDirectory;
    this.#maxRecreateAttempts = options.maxRecreateAttempts ?? LogStream.#defaultMaxRecreateAttempts;

    this.#create();
  }

  static create(options: LogStreamOptions): LogStream {
    return this.#instances[options.logFilePath] ??= new LogStream(options);
  }

  static remove(logStream: LogStream | null): void {
    if (!logStream) return;
    void this.#instances[logStream.#logFilePath]?.close();
    delete this.#instances[logStream.#logFilePath];
  }

  #create(): void {
    if (this.#createDirectory) {
      fs.mkdirSync(dirname(this.#logFilePath), {recursive: true});
    }

    try {
      fs.accessSync(dirname(this.#logFilePath), fs.constants.W_OK);
    } catch {
      throw new Error(`LogStream: directory is not writable: ${dirname(this.#logFilePath)}`);
    }

    this.#stream = fs.createWriteStream(this.#logFilePath, {flags: "a"});

    this.#stream.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code && ["ENOENT", "EPIPE"].includes(err.code)) {
        this.#recreate();
      }
    });

    this.#watcher = fs.watch(dirname(this.#logFilePath), async (_event, filename) => {
      if (!filename || filename === basename(this.#logFilePath)) {
        this.#recreate();
      }
    });
  }

  #eventEmitter: EventEmitter = new EventEmitter()

  get eventEmitter(): EventEmitter {
    return this.#eventEmitter
  }

  #recreate(): void {
    if (this.#recreateAttempts >= this.#maxRecreateAttempts) {
      void this.close();
      process.stderr.write(`accessLogMiddleware: failed to recreate log stream for ${this.#logFilePath} after ${this.#maxRecreateAttempts} attempts\n`);
      this.#eventEmitter.emit('recreateExhausted', this.#logFilePath);
      return;
    }

    this.#recreateAttempts++;
    this.#eventEmitter.emit('recreate', this.#recreateAttempts)
    void this.close();
    this.#create();
    this.#recreateAttempts = 0
  }

  #closeStreamPromises = new Set()

  async close(): Promise<void> {
    this.#watcher?.close();
    this.#watcher = null;

    const stream = this.#stream
    if (stream && !stream.destroyed) {
      this.#stream = null
      const promise = new Promise<void>(resolve => {
        stream.end(() => {
          this.#closeStreamPromises.delete(promise)
          resolve()
        })
      })
      this.#closeStreamPromises.add(promise)
    }

    await Promise.allSettled([...this.#closeStreamPromises])
  }

  get recreateAttempts(): number {
    return this.#recreateAttempts;
  }

  static reset(): void {
    Object.values(this.#instances).forEach(instance => instance.destroy())
    this.#instances = {};
  }

  destroy(): void {
    this.#watcher?.close();
    this.#watcher = null;
    this.#stream?.destroy();
    this.#stream = null;
    this.#recreateAttempts = this.#maxRecreateAttempts;
  }

  get writable(): fs.WriteStream | null {
    return this.#stream;
  }
}
