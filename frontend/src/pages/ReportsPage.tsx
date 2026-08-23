import { useEffect, useState } from 'react'
import { Inbox, Clock, CheckCircle2, AlertCircle, ShieldAlert, BarChart3, Info } from 'lucide-react'
import { api } from '../api/client'
import { Header } from '../components/Header'
import { DashboardCard } from '../components/DashboardCard'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { SkeletonRows } from '../components/Skeleton'
import type { AgentPerformance, DashboardStats } from '../types'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function ReportsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [agents, setAgents] = useState<AgentPerformance[] | null>(null)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    api.get<DashboardStats>('/reports/dashboard/').then((res) => setStats(res.data))
  }, [])

  useEffect(() => {
    setAgents(null)
    api
      .get('/reports/agent-performance/', { params: { year, month } })
      .then((res) => setAgents(res.data.agents))
      .catch((err) => {
        if (err.response?.status === 403) setForbidden(true)
      })
  }, [year, month])

  return (
    <>
      <Header
        title="Reports"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
            >
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
            >
              {[now.getFullYear(), now.getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {stats && stats.scope === 'org' && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DashboardCard label="Open conversations" value={stats.open_conversations} icon={Inbox} tone="accent" />
            <DashboardCard label="Pending conversations" value={stats.pending_conversations} icon={Clock} tone="warn" />
            <DashboardCard label="Resolved conversations" value={stats.resolved_conversations} icon={CheckCircle2} />
            <DashboardCard label="Unassigned" value={stats.unassigned_conversations} icon={AlertCircle} tone="urgent" />
          </div>
        )}

        <div className="mb-1 flex items-center gap-1.5 font-display text-sm font-semibold text-ink-900">
          <BarChart3 size={15} />
          Agent performance — {MONTH_NAMES[month - 1]} {year}
        </div>
        <div className="mb-3 flex items-center gap-1 text-xs text-ink-400">
          <Info size={11} />
          Everything here, including lead outcomes, is scoped to this month specifically — based on when each
          lead's outcome was actually set, not just its current value. One exception: outcomes set before this
          tracking existed have no recorded date and won't appear in any month until touched again.
        </div>

        {forbidden ? (
          <EmptyState icon={ShieldAlert} title="Restricted" description="Agent performance reports are available to managers and admins only." />
        ) : agents && agents.length === 0 ? (
          <EmptyState icon={BarChart3} title="No agents yet" description="Performance data will appear once agents start handling conversations." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-ink-100 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-2.5">Agent</th>
                  <th className="px-4 py-2.5">Chats this month</th>
                  <th className="px-4 py-2.5">Messages sent</th>
                  <th className="px-4 py-2.5">Open</th>
                  <th className="px-4 py-2.5">Resolved</th>
                  <th className="px-4 py-2.5">Leads successful</th>
                  <th className="px-4 py-2.5">Leads pending</th>
                  <th className="px-4 py-2.5">Leads rejected</th>
                </tr>
              </thead>
              <tbody>
                {!agents ? (
                  <SkeletonRows rows={4} cols={8} />
                ) : (
                  agents.map((a) => (
                    <tr key={a.agent_id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={a.name} size="xs" />
                          <span className="font-medium text-ink-900">{a.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-ink-600">{a.conversations_handled}</td>
                      <td className="px-4 py-2.5 text-ink-600">{a.messages_sent}</td>
                      <td className="px-4 py-2.5 text-ink-600">{a.open_conversations}</td>
                      <td className="px-4 py-2.5 text-ink-600">{a.resolved_conversations}</td>
                      <td className="px-4 py-2.5 font-medium text-signal-600">{a.leads_successful}</td>
                      <td className="px-4 py-2.5 font-medium text-amber-500">{a.leads_pending}</td>
                      <td className="px-4 py-2.5 font-medium text-red-500">{a.leads_rejected}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
