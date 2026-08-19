import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { eq, and, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'
import { db, client } from '../db/index.js'
import { protocols, tasks } from '../db/schema.js'
import { getCurrentWeek } from './tasks.js'

describe('tasks routes', () => {
  let app: FastifyInstance
  let protocolId: number
  const insertedTaskIds: number[] = []

  beforeAll(async () => {
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await client.end()
  })

  beforeEach(async () => {
    const [protocol] = await db
      .insert(protocols)
      .values({
        name: `Vitest Tasks Protocol ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        chain: 'ethereum',
        tokenStatus: 'speculative',
      })
      .returning()
    protocolId = protocol.id
  })

  afterEach(async () => {
    if (insertedTaskIds.length > 0) {
      await db.delete(tasks).where(inArray(tasks.id, insertedTaskIds))
      insertedTaskIds.length = 0
    }
    await db.delete(protocols).where(eq(protocols.id, protocolId))
  })

  it('GET /api/tasks auto-generates and returns the current week directly, without redirecting', async () => {
    const { week, year } = getCurrentWeek()

    const before = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.weekNumber, week), eq(tasks.year, year)))
    const beforeIds = new Set(before.map(t => t.id))

    const res = await app.inject({ method: 'GET', url: '/api/tasks' })

    // the pre-fix behavior was a 302 redirect to a 404ing path — this proves that's gone
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.week).toBe(week)
    expect(body.year).toBe(year)
    expect(Array.isArray(body.tasks)).toBe(true)
    expect(body.tasks.length).toBeGreaterThan(0)

    const after = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.weekNumber, week), eq(tasks.year, year)))
    const newIds = after.filter(t => !beforeIds.has(t.id)).map(t => t.id)
    if (newIds.length > 0) {
      await db.delete(tasks).where(inArray(tasks.id, newIds))
    }
  })

  it('does not create duplicate tasks on a second call within the same week', async () => {
    const { week, year } = getCurrentWeek()

    const before = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.weekNumber, week), eq(tasks.year, year)))
    const beforeIds = new Set(before.map(t => t.id))

    const res1 = await app.inject({ method: 'GET', url: '/api/tasks' })
    const res2 = await app.inject({ method: 'GET', url: '/api/tasks' })

    expect(res1.json().tasks.length).toBe(res2.json().tasks.length)

    const after = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.weekNumber, week), eq(tasks.year, year)))
    const newIds = after.filter(t => !beforeIds.has(t.id)).map(t => t.id)
    if (newIds.length > 0) {
      await db.delete(tasks).where(inArray(tasks.id, newIds))
    }
  })

  it('PATCH /api/tasks/:id/complete marks a task completed', async () => {
    const [task] = await db
      .insert(tasks)
      .values({ protocolId, weekNumber: 1, year: 1999, actionDesc: 'vitest fixture task' })
      .returning()
    insertedTaskIds.push(task.id)

    const res = await app.inject({ method: 'PATCH', url: `/api/tasks/${task.id}/complete` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.completed).toBe(true)
    expect(body.completedAt).toBeTruthy()
  })

  it('PATCH /api/tasks/:id/complete 404s for a non-existent id', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/tasks/999999999/complete' })
    expect(res.statusCode).toBe(404)
  })

  it('PATCH /api/tasks/:id/complete 404s for a non-numeric id', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/tasks/not-a-number/complete' })
    expect(res.statusCode).toBe(404)
  })
})
