import express from "express";
import {createShutdownSignal} from "./graceful-shutdown/index.js";
import type {Server} from "node:http";
import {applyMiddlewares} from "./utils/applyMiddlewares.js";

const app = express()
const signal = createShutdownSignal()
const server: { value: Server | null } = {value: null}

app.use(applyMiddlewares({
  signal,
  onDrain: () => server.value?.close(() => process.exit(0))
}))

server.value = app.listen(3000, () => {
  console.log('listen on http://localhost:3000')
})

