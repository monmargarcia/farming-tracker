import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { runWeeklyReminder, runParadexSync } from '../cron/weeklyReminder.js'

// Scheduling lives outside this app entirely (see .github/workflows/cron.yml) —
// these routes just do the work when triggered. Gated by a shared secret so an
// arbitrary internet request can't trigger a real email send or burn Alchemy/
// DeFiLlama/Paradex API calls.
function requireCronSecret(req: FastifyRequest, reply: FastifyReply): boolean {
  const expected = process.env.CRON_SECRET
  const authHeader = req.headers.authorization

  if (!expected || authHeader !== `Bearer ${expected}`) {
    reply.status(401).send({ error: 'Unauthorized' })
    return false
  }
  return true
}

export async function cronRoutes(app: FastifyInstance) {
  app.post('/cron/weekly-reminder', async (req, reply) => {
    if (!requireCronSecret(req, reply)) return
    const ok = await runWeeklyReminder()
    return reply.status(ok ? 200 : 500).send({ ok })
  })

  app.post('/cron/paradex-sync', async (req, reply) => {
    if (!requireCronSecret(req, reply)) return
    const ok = await runParadexSync()
    return reply.status(ok ? 200 : 500).send({ ok })
  })
}
