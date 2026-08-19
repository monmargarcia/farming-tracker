import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../db/index.js'
import { activities, wallets, protocols } from '../db/schema.js'
import { eq, desc } from 'drizzle-orm'
import { getEthPriceUsd } from '../services/priceService.js'
import { getGasCostUsd } from '../services/walletService.js'

const LogActivitySchema = z.object({
  walletId: z.number(),
  protocolId: z.number(),
  actionType: z.enum(['swap', 'bridge', 'lp_deposit', 'lp_withdraw', 'lend', 'borrow', 'nft_mint', 'trade']),
  txHash: z.string().optional(),
  gasUsd: z.number().optional(),
  chain: z.string().optional(),
  notes: z.string().optional(),
})

export async function activitiesRoutes(app: FastifyInstance) {
  // GET /activities — list all activity with wallet + protocol names
  app.get('/activities', async (req, reply) => {
    const rows = await db
      .select({
        id: activities.id,
        actionType: activities.actionType,
        txHash: activities.txHash,
        gasUsd: activities.gasUsd,
        chain: activities.chain,
        notes: activities.notes,
        createdAt: activities.createdAt,
        walletLabel: wallets.label,
        walletAddress: wallets.address,
        protocolName: protocols.name,
      })
      .from(activities)
      .leftJoin(wallets, eq(activities.walletId, wallets.id))
      .leftJoin(protocols, eq(activities.protocolId, protocols.id))
      .orderBy(desc(activities.createdAt))
      .limit(100)

    return reply.send(rows)
  })

  // POST /activities — log a new action you took manually
  app.post('/activities', async (req, reply) => {
    const body = LogActivitySchema.parse(req.body)

    // Manual gasUsd always wins. Only attempt auto-detect when it's omitted and
    // we have enough to look it up (EVM tx hash) — never fail the request if
    // auto-detect can't resolve a value, the activity still saves with null gas.
    let gasUsd = body.gasUsd
    if (gasUsd === undefined && body.txHash && body.chain === 'ethereum') {
      const ethPriceUsd = await getEthPriceUsd()
      if (ethPriceUsd !== null) {
        const detected = await getGasCostUsd(body.txHash, ethPriceUsd)
        if (detected > 0) {
          gasUsd = detected
        }
      }
    }

    const [inserted] = await db
      .insert(activities)
      .values({
        walletId: body.walletId,
        protocolId: body.protocolId,
        actionType: body.actionType,
        txHash: body.txHash,
        gasUsd: gasUsd?.toString(),
        chain: body.chain,
        notes: body.notes,
      })
      .returning()

    return reply.status(201).send(inserted)
  })

  // GET /activities/summary — total gas spent and action counts per protocol
  app.get('/activities/summary', async (req, reply) => {
    const rows = await db
      .select({
        protocolName: protocols.name,
        actionType: activities.actionType,
        gasUsd: activities.gasUsd,
      })
      .from(activities)
      .leftJoin(protocols, eq(activities.protocolId, protocols.id))

    // Group by protocol
    const summary: Record<string, { totalGasUsd: number; actionCount: number; actions: Record<string, number> }> = {}

    for (const row of rows) {
      const name = row.protocolName ?? 'Unknown'
      if (!summary[name]) summary[name] = { totalGasUsd: 0, actionCount: 0, actions: {} }
      summary[name].totalGasUsd += Number(row.gasUsd ?? 0)
      summary[name].actionCount++
      summary[name].actions[row.actionType] = (summary[name].actions[row.actionType] ?? 0) + 1
    }

    return reply.send(summary)
  })
}
