import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'
import * as notificationService from '../services/notificationService.js'
import * as paradexService from '../services/paradexService.js'

describe('cron routes', () => {
  let app: FastifyInstance
  const realSecret = process.env.CRON_SECRET

  beforeAll(async () => {
    process.env.CRON_SECRET = 'test-cron-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    process.env.CRON_SECRET = realSecret
    await app.close()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects a request with no Authorization header', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/cron/weekly-reminder' })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a request with the wrong secret', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cron/paradex-sync',
      headers: { authorization: 'Bearer wrong-secret' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('triggers the weekly reminder when the secret matches', async () => {
    const spy = vi.spyOn(notificationService, 'sendWeeklyReminder').mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'POST',
      url: '/api/cron/weekly-reminder',
      headers: { authorization: 'Bearer test-cron-secret' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('triggers the Paradex sync when the secret matches', async () => {
    const spy = vi.spyOn(paradexService, 'syncParadexPoints').mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'POST',
      url: '/api/cron/paradex-sync',
      headers: { authorization: 'Bearer test-cron-secret' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('returns 500 when the weekly reminder job fails, so GitHub Actions flags the run', async () => {
    vi.spyOn(notificationService, 'sendWeeklyReminder').mockRejectedValueOnce(new Error('Resend down'))

    const res = await app.inject({
      method: 'POST',
      url: '/api/cron/weekly-reminder',
      headers: { authorization: 'Bearer test-cron-secret' },
    })

    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ ok: false })
  })

  it('returns 500 when the Paradex sync job fails', async () => {
    vi.spyOn(paradexService, 'syncParadexPoints').mockRejectedValueOnce(new Error('Paradex down'))

    const res = await app.inject({
      method: 'POST',
      url: '/api/cron/paradex-sync',
      headers: { authorization: 'Bearer test-cron-secret' },
    })

    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ ok: false })
  })
})
