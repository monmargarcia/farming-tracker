import { describe, it, expect, vi, afterEach } from 'vitest'
import * as notificationService from '../services/notificationService.js'
import * as paradexService from '../services/paradexService.js'
import { runWeeklyReminder, runParadexSync } from './weeklyReminder.js'

describe('cron job error handling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runWeeklyReminder does not throw when sendWeeklyReminder fails, and reports failure', async () => {
    vi.spyOn(notificationService, 'sendWeeklyReminder').mockRejectedValueOnce(new Error('DB down'))
    await expect(runWeeklyReminder()).resolves.toBe(false)
  })

  it('runParadexSync does not throw when syncParadexPoints fails, and reports failure', async () => {
    vi.spyOn(paradexService, 'syncParadexPoints').mockRejectedValueOnce(new Error('Paradex API down'))
    await expect(runParadexSync()).resolves.toBe(false)
  })

  it('runWeeklyReminder reports success when sendWeeklyReminder succeeds', async () => {
    vi.spyOn(notificationService, 'sendWeeklyReminder').mockResolvedValueOnce(undefined)
    await expect(runWeeklyReminder()).resolves.toBe(true)
  })

  it('runParadexSync reports success when syncParadexPoints succeeds', async () => {
    vi.spyOn(paradexService, 'syncParadexPoints').mockResolvedValueOnce(undefined)
    await expect(runParadexSync()).resolves.toBe(true)
  })
})
