import { Resend } from 'resend'
import { db } from '../db/index.js'
import { activities, protocols, wallets, tasks } from '../db/schema.js'
import { eq, gte, and } from 'drizzle-orm'

// The Resend SDK throws at construction time if given no key at all (not just
// an invalid one) — that would crash the entire app on boot wherever
// RESEND_API_KEY isn't set yet, since this module loads eagerly as part of the
// whole route tree. Fall back to an obviously-fake placeholder so construction
// always succeeds; an actually-missing/invalid key still fails gracefully at
// send time, caught by runWeeklyReminder's try/catch same as before.
export const resend = new Resend(process.env.RESEND_API_KEY || 're_not_configured')

interface InactiveWallet {
  walletLabel: string
  protocolName: string
  lastActivityDate: Date | null
  daysSinceActive: number
}

// Find wallets that haven't been active for 5+ days on any protocol
export async function findInactiveWallets(): Promise<InactiveWallet[]> {
  const fiveDaysAgo = new Date()
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)

  const allWallets = await db.select().from(wallets)
  const allProtocols = await db.select().from(protocols).where(eq(protocols.active, true))
  const inactive: InactiveWallet[] = []

  for (const wallet of allWallets) {
    for (const protocol of allProtocols) {
      const recentActivity = await db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.walletId, wallet.id),
            eq(activities.protocolId, protocol.id),
            gte(activities.createdAt, fiveDaysAgo)
          )
        )
        .limit(1)

      if (recentActivity.length === 0) {
        const lastActivity = await db
          .select()
          .from(activities)
          .where(
            and(
              eq(activities.walletId, wallet.id),
              eq(activities.protocolId, protocol.id)
            )
          )
          .orderBy(activities.createdAt)
          .limit(1)

        const lastDate = lastActivity[0]?.createdAt ?? null
        const daysSince = lastDate
          ? Math.floor((Date.now() - lastDate.getTime()) / 86_400_000)
          : 999

        inactive.push({
          walletLabel: wallet.label ?? wallet.address.slice(0, 8) + '...',
          protocolName: protocol.name,
          lastActivityDate: lastDate,
          daysSinceActive: daysSince,
        })
      }
    }
  }

  return inactive
}

// Send weekly reminder email listing what needs to be done
export async function sendWeeklyReminder() {
  const inactive = await findInactiveWallets()

  if (inactive.length === 0) {
    console.log('[Notifications] All wallets active — no reminder needed')
    return
  }

  const rows = inactive
    .map(w => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${w.walletLabel}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${w.protocolName}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:${w.daysSinceActive > 6 ? '#e34948' : '#F59E0B'}">${w.daysSinceActive === 999 ? 'never' : `${w.daysSinceActive}d ago`}</td>
      </tr>
    `)
    .join('')

  const html = `
    <div style="font-family:system-ui;max-width:600px;margin:0 auto">
      <h2 style="color:#111">⚠️ Farming Tracker — Weekly Reminder</h2>
      <p style="color:#555">The following wallet/protocol combos need activity this week to stay eligible for airdrops:</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px;text-align:left">Wallet</th>
            <th style="padding:8px;text-align:left">Protocol</th>
            <th style="padding:8px;text-align:left">Last active</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#555;margin-top:24px">Open your <a href="http://localhost:5173">farming dashboard</a> to log activity after you're done.</p>
    </div>
  `

  // The Resend SDK doesn't throw on API-level failures (bad/expired key, etc.)
  // — it resolves with { data: null, error: {...} }. Not checking `error` here
  // meant a broken key would log "sent" forever while never sending anything.
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM!,
    to: process.env.RESEND_TO!,
    subject: `🌾 Farming reminder — ${inactive.length} protocol(s) need attention`,
    html,
  })

  if (error) {
    throw new Error(`Resend API error: ${error.message}`)
  }

  console.log(`[Notifications] Weekly reminder sent for ${inactive.length} inactive wallet/protocol pairs`)
}
