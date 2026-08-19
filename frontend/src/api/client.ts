import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api',
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
