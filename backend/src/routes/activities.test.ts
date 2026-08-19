import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import axios from 'axios'
import { buildApp } from '../app.js'
import { db, client } from '../db/index.js'
import { activities, protocols, wallets } from '../db/schema.js'

describe('activities routes', () => {
  let app: FastifyInstance
  let walletId: number
  let protocolId: number
  let protocolName: string
  const insertedActivityIds: number[] = []

  beforeAll(async () => {
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await client.end()
  })

  beforeEach(async () => {
    const [wallet] = await db
      .insert(wallets)
      .values({
        address: `0xVITEST${Date.now()}${Math.floor(Math.random() * 1e6)}`,
        chain: 'ethereum',
        label: 'Vitest fixture wallet',
      })
      .returning()
    walletId = wallet.id

    protocolName = `Vitest Protocol ${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const [protocol] = await db
      .insert(protocols)
      .values({ name: protocolName, chain: 'ethereum', tokenStatus: 'speculative' })
      .returning()
    protocolId = protocol.id
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    if (insertedActivityIds.length > 0) {
      await db.delete(activities).where(inArray(activities.id, insertedActivityIds))
      insertedActivityIds.length = 0
    }
    await db.delete(wallets).where(eq(wallets.id, walletId))
    await db.delete(protocols).where(eq(protocols.id, protocolId))
  })

  it('POST /api/activities creates a new activity', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/activities',
      payload: {
        walletId,
        protocolId,
        actionType: 'swap',
        txHash: '0xabc123',
        gasUsd: 5.5,
        chain: 'ethereum',
        notes: 'vitest fixture',
      },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.actionType).toBe('swap')
    expect(Number(body.gasUsd)).toBe(5.5)
    expect(body.walletId).toBe(walletId)
    expect(body.protocolId).toBe(protocolId)
    insertedActivityIds.push(body.id)
  })

  it('GET /api/activities lists the activity with wallet/protocol names joined', async () => {
    const [created] = await db
      .insert(activities)
      .values({ walletId, protocolId, actionType: 'bridge', gasUsd: '2.5000' })
      .returning()
    insertedActivityIds.push(created.id)

    const res = await app.inject({ method: 'GET', url: '/api/activities' })
    expect(res.statusCode).toBe(200)

    const body = res.json()
    const found = body.find((a: any) => a.id === created.id)
    expect(found).toBeTruthy()
    expect(found.walletLabel).toBe('Vitest fixture wallet')
    expect(found.protocolName).toBe(protocolName)
    expect(Number(found.gasUsd)).toBe(2.5)
  })

  it('GET /api/activities/summary aggregates gas and action counts per protocol', async () => {
    const rows = await db
      .insert(activities)
      .values([
        { walletId, protocolId, actionType: 'swap', gasUsd: '1.0000' },
        { walletId, protocolId, actionType: 'swap', gasUsd: '2.0000' },
        { walletId, protocolId, actionType: 'bridge', gasUsd: '3.0000' },
      ])
      .returning()
    insertedActivityIds.push(...rows.map(r => r.id))

    const res = await app.inject({ method: 'GET', url: '/api/activities/summary' })
    expect(res.statusCode).toBe(200)

    const body = res.json()
    expect(body[protocolName]).toBeTruthy()
    expect(body[protocolName].totalGasUsd).toBeCloseTo(6.0)
    expect(body[protocolName].actionCount).toBe(3)
    expect(body[protocolName].actions.swap).toBe(2)
    expect(body[protocolName].actions.bridge).toBe(1)
  })

  it('auto-detects gas cost from tx hash when gasUsd is omitted', async () => {
    vi.spyOn(axios, 'get').mockResolvedValueOnce({
      data: { coins: { 'coingecko:ethereum': { price: 1000 } } },
    })
    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { result: { gasUsed: '0x5208', effectiveGasPrice: '0x4a817c800' } },
    })
    // gasUsed 21000 * gasPrice 20 gwei = 0.00042 ETH * $1000 = $0.42

    const res = await app.inject({
      method: 'POST',
      url: '/api/activities',
      payload: { walletId, protocolId, actionType: 'swap', txHash: '0xdef456', chain: 'ethereum' },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(Number(body.gasUsd)).toBeCloseTo(0.42, 4)
    insertedActivityIds.push(body.id)
  })

  it('manual gasUsd always overrides auto-detect, without even attempting it', async () => {
    const getSpy = vi.spyOn(axios, 'get')
    const postSpy = vi.spyOn(axios, 'post')

    const res = await app.inject({
      method: 'POST',
      url: '/api/activities',
      payload: { walletId, protocolId, actionType: 'swap', txHash: '0xdef456', chain: 'ethereum', gasUsd: 99.99 },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(Number(body.gasUsd)).toBe(99.99)
    expect(getSpy).not.toHaveBeenCalled()
    expect(postSpy).not.toHaveBeenCalled()
    insertedActivityIds.push(body.id)
  })

  it('still saves the activity with null gas when auto-detect fails, never a 500', async () => {
    vi.spyOn(axios, 'get').mockRejectedValueOnce(new Error('DeFiLlama unreachable'))

    const res = await app.inject({
      method: 'POST',
      url: '/api/activities',
      payload: { walletId, protocolId, actionType: 'swap', txHash: '0xdef456', chain: 'ethereum' },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.gasUsd).toBeNull()
    insertedActivityIds.push(body.id)
  })
})
