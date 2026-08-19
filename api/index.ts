import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildApp } from '../backend/src/app.js'

// Cached across warm invocations of the same function instance — avoids
// rebuilding the Fastify app (and its DB connection) on every request.
let appPromise: ReturnType<typeof buildApp> | null = null

async function getApp() {
  if (!appPromise) {
    appPromise = buildApp().then(async app => {
      await app.ready()
      return app
    })
  }
  return appPromise
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp()
  app.server.emit('request', req, res)
}
