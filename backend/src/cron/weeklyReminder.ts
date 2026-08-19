import cron from 'node-cron'
import { sendWeeklyReminder } from '../services/notificationService.js'
import { syncParadexPoints } from '../services/paradexService.js'

// Exported (not just used inline in startCronJobs) so tests can call these
// directly and prove a failure inside either job is caught and logged rather
// than left as an unhandled rejection in an unattended background process.

export async function runWeeklyReminder() {
  console.log('[Cron] Running weekly reminder...')
  try {
    await sendWeeklyReminder()
  } catch (err) {
    console.error('[Cron] Weekly reminder failed:', err instanceof Error ? err.message : err)
  }
}

export async function runParadexSync() {
  console.log('[Cron] Syncing Paradex points...')
  try {
    await syncParadexPoints()
  } catch (err) {
    console.error('[Cron] Paradex points sync failed:', err instanceof Error ? err.message : err)
  }
}

export function startCronJobs() {
  // Every Monday at 9:00 AM SGT (UTC+8 = 01:00 UTC)
  // Send reminder email if any wallet has been inactive for 5+ days
  cron.schedule('0 1 * * 1', runWeeklyReminder, { timezone: 'Asia/Singapore' })

  // Every 6 hours — sync Paradex XP points
  cron.schedule('0 */6 * * *', runParadexSync)

  console.log('[Cron] Jobs registered: weekly reminder + Paradex points sync')
}
