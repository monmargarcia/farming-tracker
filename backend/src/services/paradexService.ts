import axios from 'axios'
import { z } from 'zod'
import { db } from '../db/index.js'
import { protocolPoints, protocols, wallets } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'

const BASE_URL = 'https://api.prod.paradex.trade/v1'

// Validated at the network boundary — a vendor API shape change should mean a
// skipped poll, never a garbage row silently inserted into protocol_points.
const ParadexAccountSchema = z.object({
  account: z.string(),
  points: z.union([z.string(), z.number()]).transform(String),
  rank: z.coerce.number(),
})

type ParadexAccount = z.infer<typeof ParadexAccountSchema>

// Fetch XP points for a starknet address from Paradex
export async function fetchParadexPoints(starknetAddress: string): Promise<ParadexAccount | null> {
  try {
    const res = await axios.get(`${BASE_URL}/points/leaderboard`, {
      params: { account: starknetAddress },
      timeout: 10_000,
    })

    const parsed = ParadexAccountSchema.safeParse(res.data)
    if (!parsed.success) {
      console.warn('[ParadexService] Unexpected points response shape:', parsed.error.message)
      return null
    }
    return parsed.data
  } catch (err) {
    console.error('[ParadexService] Failed to fetch points:', err instanceof Error ? err.message : err)
    return null
  }
}

// Fetch recent fills (trades) for a starknet address
export async function fetchParadexFills(starknetAddress: string) {
  try {
    const res = await axios.get(`${BASE_URL}/fills`, {
      params: { account: starknetAddress, page_size: 50 },
      timeout: 10_000,
    })
    return res.data?.results ?? []
  } catch (err) {
    console.error('[ParadexService] Failed to fetch fills:', err instanceof Error ? err.message : err)
    return []
  }
}

// Poll points for all starknet wallets and record a new protocol_points row per
// wallet (history table by design — each poll is a new data point, not an upsert)
export async function syncParadexPoints() {
  const [protocol] = await db
    .select()
    .from(protocols)
    .where(eq(protocols.name, 'Paradex'))

  if (!protocol) {
    console.warn('[ParadexService] Paradex protocol not found in DB')
    return
  }

  const starknetWallets = await db
    .select()
    .from(wallets)
    .where(eq(wallets.chain, 'starknet'))

  for (const wallet of starknetWallets) {
    const data = await fetchParadexPoints(wallet.address)
    if (!data) continue

    await db.insert(protocolPoints).values({
      walletId: wallet.id,
      protocolId: protocol.id,
      points: data.points,
      rank: data.rank,
    })

    console.log(`[ParadexService] Synced points for ${wallet.label ?? wallet.address}: ${data.points} XP (rank #${data.rank})`)
  }
}
