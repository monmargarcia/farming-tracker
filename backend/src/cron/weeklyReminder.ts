import { sendWeeklyReminder } from '../services/notificationService.js'
import { syncParadexPoints } from '../services/paradexService.js'

// Exported so tests can call these directly, and so the HTTP-triggered routes
// in routes/cron.ts can invoke them without duplicating error handling.
// Scheduling itself lives outside this app entirely — see
// .github/workflows/cron.yml. There is no in-process scheduler here: Vercel
// deploys this app as stateless serverless functions, which can't host a
// long-running node-cron timer.
//
// Return a success boolean (rather than letting the error propagate) so the
// route layer can surface a real HTTP failure — GitHub Actions marks a cron
// run failed/notifies on a non-2xx response, which is the whole point of
// running this via CI instead of silently swallowing the error.

export async function runWeeklyReminder(): Promise<boolean> {
  console.log('[Cron] Running weekly reminder...')
  try {
    await sendWeeklyReminder()
    return true
  } catch (err) {
    console.error('[Cron] Weekly reminder failed:', err instanceof Error ? err.message : err)
    return false
  }
}

export async function runParadexSync(): Promise<boolean> {
  console.log('[Cron] Syncing Paradex points...')
  try {
    await syncParadexPoints()
    return true
  } catch (err) {
    console.error('[Cron] Paradex points sync failed:', err instanceof Error ? err.message : err)
    return false
  }
}
