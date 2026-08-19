import 'dotenv/config'
import { inArray } from 'drizzle-orm'
import { db } from './index.js'
import { protocols, wallets } from './schema.js'

const PROTOCOLS = [
  { name: 'MetaMask Rewards', chain: 'ethereum', tokenStatus: 'confirmed' },
  { name: 'Paradex', chain: 'starknet', tokenStatus: 'points_live', apiUrl: 'https://api.prod.paradex.trade/v1' },
  { name: 'Pacifica', chain: 'solana', tokenStatus: 'points_live' },
  { name: 'Ethereal', chain: 'ethereum', tokenStatus: 'speculative' },
]

async function seedProtocols() {
  const existing = await db
    .select({ name: protocols.name })
    .from(protocols)
    .where(inArray(protocols.name, PROTOCOLS.map(p => p.name)))

  const existingNames = new Set(existing.map(p => p.name))
  const toInsert = PROTOCOLS.filter(p => !existingNames.has(p.name))

  if (toInsert.length === 0) {
    console.log('[Seed] All protocols already present, skipping')
    return
  }

  await db.insert(protocols).values(toInsert)
  console.log(`[Seed] Inserted ${toInsert.length} protocol(s): ${toInsert.map(p => p.name).join(', ')}`)
}

async function seedWallets() {
  const addresses = (process.env.FARMING_WALLETS ?? '')
    .split(',')
    .map(a => a.trim())
    .filter(Boolean)

  if (addresses.length === 0) {
    console.warn('[Seed] FARMING_WALLETS is empty — no wallet seeded')
    return
  }

  for (const address of addresses) {
    const inserted = await db
      .insert(wallets)
      .values({ address, chain: 'ethereum', label: 'Farming 01' })
      .onConflictDoNothing({ target: wallets.address })
      .returning({ id: wallets.id })

    console.log(inserted.length > 0
      ? `[Seed] Inserted wallet ${address}`
      : `[Seed] Wallet ${address} already present, skipping`)
  }
}

async function main() {
  await seedProtocols()
  await seedWallets()

  const allProtocols = await db.select().from(protocols)
  const allWallets = await db.select().from(wallets)
  console.log(`[Seed] Done. protocols=${allProtocols.length} wallets=${allWallets.length}`)
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[Seed] Failed:', err)
    process.exit(1)
  })
