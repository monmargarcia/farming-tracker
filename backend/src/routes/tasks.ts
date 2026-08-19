import { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { tasks, protocols } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'

// Get current ISO week number
export function getCurrentWeek(): { week: number; year: number } {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const week = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
  return { week, year: now.getFullYear() }
}

async function queryWeeklyTasks(week: number, year: number) {
  return db
    .select({
      id: tasks.id,
      actionDesc: tasks.actionDesc,
      completed: tasks.completed,
      completedAt: tasks.completedAt,
      protocolName: protocols.name,
      protocolChain: protocols.chain,
    })
    .from(tasks)
    .leftJoin(protocols, eq(tasks.protocolId, protocols.id))
    .where(and(eq(tasks.weekNumber, week), eq(tasks.year, year)))
}

export async function tasksRoutes(app: FastifyInstance) {
  // GET /tasks — return this week's checklist
  app.get('/tasks', async (req, reply) => {
    const { week, year } = getCurrentWeek()

    let rows = await queryWeeklyTasks(week, year)

    // If no tasks exist for this week yet, auto-generate them and return the fresh rows
    if (rows.length === 0) {
      await generateWeeklyTasks(week, year)
      rows = await queryWeeklyTasks(week, year)
    }

    return reply.send({ week, year, tasks: rows })
  })

  // PATCH /tasks/:id/complete — mark a task done
  app.patch('/tasks/:id/complete', async (req, reply) => {
    const { id } = req.params as { id: string }
    const taskId = parseInt(id)

    if (Number.isNaN(taskId)) {
      return reply.notFound('Invalid task id')
    }

    const [updated] = await db
      .update(tasks)
      .set({ completed: true, completedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .returning()

    if (!updated) {
      return reply.notFound('Task not found')
    }

    return reply.send(updated)
  })
}

// Generate standard weekly tasks for all active protocols
async function generateWeeklyTasks(week: number, year: number) {
  const activeProtocols = await db
    .select()
    .from(protocols)
    .where(eq(protocols.active, true))

  const defaultTasks: Record<string, string[]> = {
    'MetaMask Rewards': [
      'Swap ETH → USDC on MetaMask mobile',
      'Swap USDC → ETH on MetaMask mobile',
      'Check Rewards points in MetaMask mobile app',
    ],
    'Paradex': [
      'Open a small long or short position on Paradex',
      'Check your XP rank on the Paradex leaderboard',
    ],
    'Pacifica': [
      'Log into Pacifica and place a trade',
      'Check weekly points allocation',
    ],
    'Ethereal': [
      'Make a swap on Ethereal DEX',
      'Check for any new points announcements',
    ],
  }

  const inserts = activeProtocols.flatMap(protocol => {
    const taskList = defaultTasks[protocol.name] ?? [`Do weekly activity on ${protocol.name}`]
    return taskList.map(actionDesc => ({
      protocolId: protocol.id,
      weekNumber: week,
      year,
      actionDesc,
    }))
  })

  if (inserts.length > 0) {
    await db.insert(tasks).values(inserts)
  }
}
