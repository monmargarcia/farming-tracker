import { pgTable, serial, varchar, integer, boolean, timestamp, numeric, text } from 'drizzle-orm/pg-core'

// ─── Wallets ────────────────────────────────────────────────────────────────
// Stores public addresses only — never private keys or seed phrases
export const wallets = pgTable('wallets', {
  id: serial('id').primaryKey(),
  address: varchar('address', { length: 100 }).notNull().unique(),
  chain: varchar('chain', { length: 50 }).notNull(),   // ethereum | starknet | solana
  label: varchar('label', { length: 100 }),             // e.g. "Farming 01"
  createdAt: timestamp('created_at').defaultNow(),
})

// ─── Protocols ───────────────────────────────────────────────────────────────
export const protocols = pgTable('protocols', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  chain: varchar('chain', { length: 50 }).notNull(),
  tokenStatus: varchar('token_status', { length: 50 }).notNull(), // confirmed | speculative | points_live
  websiteUrl: varchar('website_url', { length: 255 }),
  apiUrl: varchar('api_url', { length: 255 }),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
})

// ─── Activities ──────────────────────────────────────────────────────────────
// Core table — every action you take manually gets logged here
// This is your sybil defense record: proves activity was spread naturally over time
export const activities = pgTable('activities', {
  id: serial('id').primaryKey(),
  walletId: integer('wallet_id').references(() => wallets.id).notNull(),
  protocolId: integer('protocol_id').references(() => protocols.id).notNull(),
  actionType: varchar('action_type', { length: 50 }).notNull(), // swap | bridge | lp_deposit | lp_withdraw | lend | borrow | nft_mint | trade
  txHash: varchar('tx_hash', { length: 100 }),
  gasUsd: numeric('gas_usd', { precision: 10, scale: 4 }),
  chain: varchar('chain', { length: 50 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
})

// ─── Protocol Points ─────────────────────────────────────────────────────────
// Polled automatically from each protocol's API
export const protocolPoints = pgTable('protocol_points', {
  id: serial('id').primaryKey(),
  walletId: integer('wallet_id').references(() => wallets.id).notNull(),
  protocolId: integer('protocol_id').references(() => protocols.id).notNull(),
  points: numeric('points', { precision: 20, scale: 4 }),
  rank: integer('rank'),
  fetchedAt: timestamp('fetched_at').defaultNow(),
})

// ─── Tasks ───────────────────────────────────────────────────────────────────
// Weekly checklist — what to do this week per protocol
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  protocolId: integer('protocol_id').references(() => protocols.id).notNull(),
  weekNumber: integer('week_number').notNull(),  // ISO week 1-52
  year: integer('year').notNull(),
  actionDesc: varchar('action_desc', { length: 255 }).notNull(),
  completed: boolean('completed').default(false),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
})

export type Wallet = typeof wallets.$inferSelect
export type Protocol = typeof protocols.$inferSelect
export type Activity = typeof activities.$inferSelect
export type ProtocolPoints = typeof protocolPoints.$inferSelect
export type Task = typeof tasks.$inferSelect
