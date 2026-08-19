import axios from 'axios'

// In production, frontend and backend are served from the same Vercel domain
// (see /api/[...path].ts + vercel.json), so a relative path is correct and
// avoids ever hardcoding a deploy URL. Local dev needs the separate backend
// dev server's absolute URL instead.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api'),
})

export async function getActivities() {
  const { data } = await api.get('/activities')
  return data
}

export async function getActivitySummary() {
  const { data } = await api.get('/activities/summary')
  return data
}

export async function logActivity(payload: {
  walletId: number
  protocolId: number
  actionType: string
  txHash?: string
  gasUsd?: number
  chain?: string
  notes?: string
}) {
  const { data } = await api.post('/activities', payload)
  return data
}

export async function getTasks() {
  const { data } = await api.get('/tasks')
  return data
}

export async function completeTask(id: number) {
  const { data } = await api.patch(`/tasks/${id}/complete`)
  return data
}
