import { describe, it, expect, vi, afterEach } from 'vitest'
import * as notificationService from '../services/notificationService.js'
import * as paradexService from '../services/paradexService.js'
import { runWeeklyReminder, runParadexSync } from './weeklyReminder.js'

describe('cron job error handling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runWeeklyReminder does not throw when sendWeeklyReminder fails', async () => {
    vi.spyOn(notificationService, 'sendWeeklyReminder').mockRejectedValueOnce(new Error('DB down'))
    await expect(runWeeklyReminder()).resolves.toBeUndefined()
  })

  it('runParadexSync does not throw when syncParadexPoints fails', async () => {
    vi.spyOn(paradexService, 'syncParadexPoints').mockRejectedValueOnce(new Error('Paradex API down'))
    await expect(runParadexSync()).resolves.toBeUndefined()
  })
})
