import { useEffect, useState } from 'react'
import {
  Users, UserPlus, Inbox, Clock, CheckCircle2, AlertCircle,
  UserCog, ArrowDownToLine, ArrowUpFromLine, MailWarning, Send,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Header } from '../components/Header'
import { DashboardCard } from '../components/DashboardCard'
import { Skeleton } from '../components/Skeleton'
import { ActivityFeed, type AuditLogEntry } from '../components/ActivityFeed'
import type { DashboardStats } from '../types'

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<AuditLogEntry[] | null>(null)
  const [activityForbidden, setActivityForbidden] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api.get<DashboardStats>('/reports/dashboard/').then((res) => setStats(res.data))
  }, [])

  useEffect(() => {
    api
      .get('/audit-logs/', { params: { page_size: 10 } })
      .then((res) => setActivity(res.data.results ?? res.data))
      .catch((err) => {
        if (err.response?.status === 403) setActivityForbidden(true)
      })
  }, [])

  return (
    <>
      <Header title="Dashboard" />
      <div className="flex-1 overflow-y-auto bg-ink-50 p-6">
        {/* Thin brand stripe — blue leading, a small red accent trailing,
            matching the actual brand ratio (blue dominant, red secondary)
            rather than treating them as equal partners. */}
        <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-ink-100">
          <div className="h-full w-full bg-gradient-to-r from-brand-600 via-brand-500 to-red-500" />
        </div>

        {!stats ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-ink-100 bg-white p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-7 w-12" />
              </div>
            ))}
          </div>
        ) : stats.scope === 'org' ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <DashboardCard label="Total customers" value={stats.total_customers} icon={Users} tone="accent" />
            <DashboardCard label="New leads" value={stats.new_leads} icon={UserPlus} tone="accent" />
            <DashboardCard label="Open conversations" value={stats.open_conversations} icon={Inbox} tone="accent" />
            <DashboardCard label="Pending conversations" value={stats.pending_conversations} icon={Clock} tone="warn" />
            <DashboardCard label="Resolved conversations" value={stats.resolved_conversations} icon={CheckCircle2} />
            <DashboardCard label="Unassigned conversations" value={stats.unassigned_conversations} icon={AlertCircle} tone="urgent" />
            <DashboardCard label="Active agents" value={stats.active_agents} icon={UserCog} tone="accent" />
            <DashboardCard label="Today's incoming" value={stats.todays_incoming_messages} icon={ArrowDownToLine} tone="accent" />
            <DashboardCard label="Today's outgoing" value={stats.todays_outgoing_messages} icon={ArrowUpFromLine} tone="accent" />
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-500">Your work, at a glance. Head to Inbox to dig into any of these.</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <button onClick={() => navigate('/inbox')} className="text-left">
                <DashboardCard label="My open conversations" value={stats.my_open_conversations} icon={Inbox} tone="accent" />
              </button>
              <button onClick={() => navigate('/inbox')} className="text-left">
                <DashboardCard label="My pending" value={stats.my_pending_conversations} icon={Clock} tone="warn" />
              </button>
              <button onClick={() => navigate('/inbox')} className="text-left">
                <DashboardCard label="My unread" value={stats.my_unread_conversations} icon={MailWarning} tone="urgent" />
              </button>
              <DashboardCard label="My resolved" value={stats.my_resolved_conversations} icon={CheckCircle2} tone="accent" />
              <DashboardCard label="Messages sent today" value={stats.my_messages_sent_today} icon={Send} tone="accent" />
            </div>
          </>
        )}

        {!activityForbidden && (
          <div className="mt-8">
            <div className="mb-3 font-display text-sm font-semibold text-ink-900">Recent activity</div>
            <div className="overflow-x-auto rounded-lg border border-ink-100 bg-white">
              {!activity ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-7 w-7 rounded-full" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  ))}
                </div>
              ) : (
                <ActivityFeed entries={activity} />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
