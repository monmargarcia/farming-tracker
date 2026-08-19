import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db, client } from '../db/index.js'
import { activities, protocols, wallets } from '../db/schema.js'
import { resend, sendWeeklyReminder } from './notificationService.js'

describe('notificationService — sendWeeklyReminder', () => {
  let realWalletId: number
  let realProtocolIds: number[]
  const insertedActivityIds: number[] = []
  let testWalletId: number | null = null
  let testProtocolId: number | null = null

  beforeAll(async () => {
    const farmingAddress = (process.env.FARMING_WALLETS ?? '').split(',')[0]?.trim()
    const [realWallet] = await db.select().from(wallets).where(eq(wallets.address, farmingAddress))
    if (!realWallet) {
      throw new Error('Real farming wallet not found — run db:seed first')
    }
    realWalletId = realWallet.id

    const activeProtocols = await db.select().from(protocols).where(eq(protocols.active, true))
    realProtocolIds = activeProtocols.map(p => p.id)
  })

  afterAll(async () => {
    await client.end()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    if (insertedActivityIds.length > 0) {
      await db.delete(activities).where(inArray(activities.id, insertedActivityIds))
      insertedActivityIds.length = 0
    }
    if (testWalletId !== null) {
      await db.delete(wallets).where(eq(wallets.id, testWalletId))
      testWalletId = null
    }
    if (testProtocolId !== null) {
      await db.delete(protocols).where(eq(protocols.id, testProtocolId))
      testProtocolId = null
    }
  })

  it('sends a reminder listing a wallet/protocol pair with no activity', async () => {
    const [wallet] = await db
      .insert(wallets)
      .values({ address: `0xVITESTREMIND${Date.now()}`, chain: 'ethereum', label: 'Vitest Never Active Wallet' })
      .returning()
    testWalletId = wallet.id

    const [protocol] = await db
      .insert(protocols)
      .values({ name: `Vitest Reminder Protocol ${Date.now()}`, chain: 'ethereum', tokenStatus: 'speculative', active: true })
      .returning()
    testProtocolId = protocol.id

    const sendSpy = vi.spyOn(resend.emails, 'send').mockResolvedValue({ data: { id: 'test' }, error: null } as any)

    await sendWeeklyReminder()

    expect(sendSpy).toHaveBeenCalledTimes(1)
    const callArgs = sendSpy.mock.calls[0][0] as any
    expect(callArgs.to).toBe(process.env.RESEND_TO)
    expect(callArgs.from).toBe(process.env.RESEND_FROM)
    expect(callArgs.html).toContain('Vitest Never Active Wallet')
    expect(callArgs.html).toContain(protocol.name)
    expect(callArgs.html).toContain('never')
  })

  it('excludes a wallet/protocol pair that has recent activity', async () => {
    const [wallet] = await db
      .insert(wallets)
      .values({ address: `0xVITESTACTIVE${Date.now()}`, chain: 'ethereum', label: 'Vitest Recently Active Wallet' })
      .returning()
    testWalletId = wallet.id

    const [protocol] = await db
      .insert(protocols)
      .values({ name: `Vitest Active Protocol ${Date.now()}`, chain: 'ethereum', tokenStatus: 'speculative', active: true })
      .returning()
    testProtocolId = protocol.id

    const [activity] = await db
      .insert(activities)
      .values({ walletId: wallet.id, protocolId: protocol.id, actionType: 'swap' })
      .returning()
    insertedActivityIds.push(activity.id)

    const sendSpy = vi.spyOn(resend.emails, 'send').mockResolvedValue({ data: { id: 'test' }, error: null } as any)

    await sendWeeklyReminder()

    // Real seeded wallet is still inactive against real protocols, so a send
    // still happens — and this same test wallet is also legitimately inactive
    // against every OTHER active protocol (it has activity for exactly one).
    // The point of this test is only that the wallet+protocol PAIR that does
    // have recent activity is excluded — not that the wallet's label never
    // appears anywhere in the email.
    expect(sendSpy).toHaveBeenCalledTimes(1)
    const callArgs = sendSpy.mock.calls[0][0] as any
    const rows: string[] = callArgs.html.split('<tr>')
    const matchingRow = rows.find(r => r.includes('Vitest Recently Active Wallet') && r.includes(protocol.name))
    expect(matchingRow).toBeUndefined()
  })

  it('does not send anything when every wallet/protocol pair is recently active', async () => {
    // Temporarily give the real seeded wallet fresh activity against every real
    // active protocol so the whole DB has zero inactive pairs. Deleted
    // immediately after the assertion in afterEach — never left in place.
    const rows = await db
      .insert(activities)
      .values(
        realProtocolIds.map(protocolId => ({
          walletId: realWalletId,
          protocolId,
          actionType: 'swap' as const,
          notes: 'vitest fixture — temporary, deleted at end of test',
        }))
      )
      .returning()
    insertedActivityIds.push(...rows.map(r => r.id))

    const sendSpy = vi.spyOn(resend.emails, 'send')

    await sendWeeklyReminder()

    expect(sendSpy).not.toHaveBeenCalled()
  })
})
