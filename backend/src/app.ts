import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import { activitiesRoutes } from './routes/activities.js'
import { tasksRoutes } from './routes/tasks.js'
import { cronRoutes } from './routes/cron.js'

export async function buildApp() {
  const app = Fastify({ logger: false })

  // @fastify/cors v11's default `methods` list is GET,HEAD,POST only — narrower
  // than v9's, which silently broke PATCH /tasks/:id/complete's preflight when
  // that package was bumped in Step 4. Listing the actual API surface explicitly
  // so a future CORS package upgrade can't silently drop a method again.
  await app.register(cors, { origin: 'http://localhost:5173', methods: ['GET', 'POST', 'PATCH'] })
  await app.register(sensible)

  await app.register(activitiesRoutes, { prefix: '/api' })
  await app.register(tasksRoutes, { prefix: '/api' })
  await app.register(cronRoutes, { prefix: '/api' })

  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

  return app
}
