import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { eq } from 'drizzle-orm'
import axios from 'axios'
import { db, client } from '../db/index.js'
import { protocolPoints, protocols, wallets } from '../db/schema.js'
import { syncParadexPoints } from './paradexService.js'

describe('paradexService', () => {
  let walletId: number

  beforeAll(async () => {
    const [protocol] = await db.select().from(protocols).where(eq(protocols.name, 'Paradex'))
    if (!protocol) {
      throw new Error('Paradex protocol not found in seed data — run db:seed first')
    }
  })

  afterAll(async () => {
    await client.end()
  })

  beforeEach(async () => {
    const [wallet] = await db
      .insert(wallets)
      .values({
        address: `starknet-vitest-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        chain: 'starknet',
        label: 'Vitest Paradex fixture',
      })
      .returning()
    walletId = wallet.id
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await db.delete(protocolPoints).where(eq(protocolPoints.walletId, walletId))
    await db.delete(wallets).where(eq(wallets.id, walletId))
  })

  it('inserts points and rank correctly for a starknet wallet', async () => {
    const [paradexProtocol] = await db.select().from(protocols).where(eq(protocols.name, 'Paradex'))

    vi.spyOn(axios, 'get').mockResolvedValueOnce({
      data: { account: 'test-account', points: '1234.5678', rank: 42 },
    })

    await syncParadexPoints()

    const rows = await db.select().from(protocolPoints).where(eq(protocolPoints.walletId, walletId))
    expect(rows.length).toBe(1)
    expect(Number(rows[0].points)).toBeCloseTo(1234.5678, 4)
    expect(rows[0].rank).toBe(42)
    expect(rows[0].protocolId).toBe(paradexProtocol.id)
  })

  it('a second poll appends a new row rather than overwriting', async () => {
    vi.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: { account: 'test-account', points: '100.0000', rank: 50 } })
      .mockResolvedValueOnce({ data: { account: 'test-account', points: '150.0000', rank: 45 } })

    await syncParadexPoints()
    await syncParadexPoints()

    const rows = await db
      .select()
      .from(protocolPoints)
      .where(eq(protocolPoints.walletId, walletId))
      .orderBy(protocolPoints.id)

    expect(rows.length).toBe(2)
    expect(Number(rows[0].points)).toBeCloseTo(100, 4)
    expect(Number(rows[1].points)).toBeCloseTo(150, 4)
  })

  it('rejects a malformed API response instead of inserting garbage', async () => {
    vi.spyOn(axios, 'get').mockResolvedValueOnce({ data: { unexpected: 'shape' } })

    await syncParadexPoints()

    const rows = await db.select().from(protocolPoints).where(eq(protocolPoints.walletId, walletId))
    expect(rows.length).toBe(0)
  })
})
