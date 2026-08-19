import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { getActivities, getActivitySummary, getTasks, completeTask, logActivity } from '../api/client'
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

// `chain` is a display label; `chainId` is the lowercase value the backend
// expects on activities.chain (and is what triggers Step 5's gas auto-detect
// when it equals 'ethereum').
const PROTOCOLS = [
  { id: 1, name: 'MetaMask Rewards', chain: 'EVM', chainId: 'ethereum', status: 'confirmed', color: '#F59E0B' },
  { id: 2, name: 'Paradex', chain: 'Starknet', chainId: 'starknet', status: 'points_live', color: '#3B82F6' },
  { id: 3, name: 'Pacifica', chain: 'Solana', chainId: 'solana', status: 'points_live', color: '#10B981' },
  { id: 4, name: 'Ethereal', chain: 'EVM', chainId: 'ethereum', status: 'speculative', color: '#8B5CF6' },
]

export default function Dashboard() {
  const qc = useQueryClient()
  const [logOpen, setLogOpen] = useState(false)
  const [form, setForm] = useState({ walletId: 1, protocolId: 1, actionType: 'swap', txHash: '', gasUsd: '', notes: '' })

  const { data: activities = [] } = useQuery({ queryKey: ['activities'], queryFn: getActivities, refetchInterval: 30_000 })
  const { data: summary = {} } = useQuery({ queryKey: ['summary'], queryFn: getActivitySummary })
  const { data: taskData } = useQuery({ queryKey: ['tasks'], queryFn: getTasks })

  const completeMutation = useMutation({
    mutationFn: completeTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const logMutation = useMutation({
    mutationFn: logActivity,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities'] })
      qc.invalidateQueries({ queryKey: ['summary'] })
      setLogOpen(false)
    },
  })

  const totalGas = Object.values(summary).reduce((sum: number, s: any) => sum + s.totalGasUsd, 0)
  const chartData = Object.entries(summary).map(([name, s]: [string, any]) => ({ name, gas: s.totalGasUsd.toFixed(2), actions: s.actionCount }))

  return (
    <div style={{ fontFamily: 'system-ui', background: '#0E1117', minHeight: '100vh', color: '#F1F5F9', padding: '24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace', margin: '0 0 2px', letterSpacing: '0.06em' }}>FARMING TRACKER</p>
            <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>Dashboard</h1>
          </div>
          <button
            onClick={() => setLogOpen(true)}
            style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 500 }}
          >
            + Log Activity
          </button>
        </div>

        {/* Metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'total gas spent', value: `$${totalGas.toFixed(2)}` },
            { label: 'actions logged', value: activities.length },
            { label: 'protocols farming', value: PROTOCOLS.length },
            { label: 'tasks this week', value: taskData?.tasks?.length ?? 0 },
          ].map(m => (
            <div key={m.label} style={{ background: '#161B27', borderRadius: 12, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 4px' }}>{m.label}</p>
              <p style={{ fontSize: 22, fontWeight: 500, margin: 0, fontFamily: 'monospace' }}>{m.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Weekly tasks */}
          <div style={{ background: '#161B27', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: '#64748B', margin: '0 0 14px', letterSpacing: '0.05em' }}>THIS WEEK'S TASKS</p>
            {taskData?.tasks?.length === 0 && <p style={{ color: '#64748B', fontSize: 13 }}>All done for this week 🎉</p>}
            {taskData?.tasks?.map((task: any) => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => !task.completed && completeMutation.mutate(task.id)}
                  style={{ marginTop: 2, cursor: 'pointer', accentColor: '#10B981' }}
                />
                <div>
                  <p style={{ fontSize: 13, margin: 0, textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? '#64748B' : '#F1F5F9' }}>{task.actionDesc}</p>
                  <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0', fontFamily: 'monospace' }}>{task.protocolName} · {task.protocolChain}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Gas chart */}
          <div style={{ background: '#161B27', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: '#64748B', margin: '0 0 14px', letterSpacing: '0.05em' }}>GAS SPENT PER PROTOCOL (USD)</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 8, fontSize: 12 }} formatter={(v: any) => [`$${v}`, 'Gas']} />
                <Bar dataKey="gas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent activity */}
        <div style={{ background: '#161B27', borderRadius: 12, padding: '16px 20px' }}>
          <p style={{ fontSize: 11, fontWeight: 500, color: '#64748B', margin: '0 0 14px', letterSpacing: '0.05em' }}>RECENT ACTIVITY</p>
          {activities.slice(0, 8).map((a: any) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #1E293B' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', background: '#1E293B', color: '#94A3B8', padding: '2px 8px', borderRadius: 4 }}>{a.actionType}</span>
                <span style={{ fontSize: 13, color: '#F1F5F9' }}>{a.protocolName}</span>
                <span style={{ fontSize: 12, color: '#64748B' }}>{a.walletLabel ?? a.walletAddress?.slice(0, 8) + '...'}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {a.gasUsd && <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#EF4444' }}>−${Number(a.gasUsd).toFixed(2)}</span>}
                <span style={{ fontSize: 11, color: '#64748B' }}>{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Log activity modal */}
        {logOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: '#161B27', borderRadius: 16, padding: 24, width: 400 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 500 }}>Log activity</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <select value={form.protocolId} onChange={e => setForm(f => ({ ...f, protocolId: +e.target.value }))} style={{ background: '#0E1117', color: '#F1F5F9', border: '0.5px solid #334155', borderRadius: 8, padding: '8px 12px' }}>
                  {PROTOCOLS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={form.actionType} onChange={e => setForm(f => ({ ...f, actionType: e.target.value }))} style={{ background: '#0E1117', color: '#F1F5F9', border: '0.5px solid #334155', borderRadius: 8, padding: '8px 12px' }}>
                  {['swap', 'bridge', 'lp_deposit', 'lp_withdraw', 'lend', 'borrow', 'nft_mint', 'trade'].map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <input placeholder="Tx hash (optional)" value={form.txHash} onChange={e => setForm(f => ({ ...f, txHash: e.target.value }))} style={{ background: '#0E1117', color: '#F1F5F9', border: '0.5px solid #334155', borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }} />
                <input placeholder="Gas cost in USD — leave blank to auto-detect from tx hash" type="number" value={form.gasUsd} onChange={e => setForm(f => ({ ...f, gasUsd: e.target.value }))} style={{ background: '#0E1117', color: '#F1F5F9', border: '0.5px solid #334155', borderRadius: 8, padding: '8px 12px' }} />
                <input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ background: '#0E1117', color: '#F1F5F9', border: '0.5px solid #334155', borderRadius: 8, padding: '8px 12px' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setLogOpen(false)} style={{ flex: 1, background: '#1E293B', color: '#94A3B8', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer' }}>Cancel</button>
                <button
                  onClick={() => logMutation.mutate({
                    walletId: form.walletId,
                    protocolId: form.protocolId,
                    actionType: form.actionType,
                    txHash: form.txHash || undefined,
                    gasUsd: form.gasUsd ? +form.gasUsd : undefined,
                    chain: PROTOCOLS.find(p => p.id === form.protocolId)?.chainId,
                    notes: form.notes || undefined,
                  })}
                  style={{ flex: 1, background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontWeight: 500 }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
