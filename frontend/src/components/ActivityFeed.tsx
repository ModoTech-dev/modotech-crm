import {
  LogIn, LogOut, UserX, UserCheck, ArrowRightLeft,
  MessageSquareText, Settings2, Activity as ActivityIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface AuditLogEntry {
  id: string
  user_email: string | null
  action: string
  object_type: string
  created_at: string
}

const ACTION_META: Record<string, { icon: LucideIcon; describe: (e: AuditLogEntry) => string }> = {
  LOGIN: { icon: LogIn, describe: (e) => `${e.user_email ?? 'Someone'} signed in` },
  LOGOUT: { icon: LogOut, describe: (e) => `${e.user_email ?? 'Someone'} signed out` },
  USER_DISABLED: { icon: UserX, describe: (e) => `${e.user_email ?? 'An admin'} disabled a user` },
  USER_ENABLED: { icon: UserCheck, describe: (e) => `${e.user_email ?? 'An admin'} enabled a user` },
  CONVERSATION_ASSIGNED: { icon: ArrowRightLeft, describe: (e) => `${e.user_email ?? 'Someone'} assigned a conversation` },
  CONVERSATION_STATUS_CHANGED: { icon: MessageSquareText, describe: (e) => `${e.user_email ?? 'Someone'} updated a conversation's status` },
}

function describeAction(entry: AuditLogEntry): { icon: LucideIcon; text: string } {
  const meta = ACTION_META[entry.action]
  if (meta) return { icon: meta.icon, text: meta.describe(entry) }
  // Fallback for the generic middleware-logged actions, e.g. "POST /api/customers/"
  const [method, path] = entry.action.split(' ')
  if (path) {
    const verb = method === 'POST' ? 'created' : method === 'DELETE' ? 'deleted' : 'updated'
    const resource = path.split('/').filter(Boolean).pop() || 'a record'
    return { icon: Settings2, text: `${entry.user_email ?? 'Someone'} ${verb} ${resource}` }
  }
  return { icon: ActivityIcon, text: entry.action }
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function ActivityFeed({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <div className="px-4 py-6 text-center text-sm text-ink-400">No activity yet.</div>
  }
  return (
    <ul className="divide-y divide-ink-100">
      {entries.map((entry) => {
        const { icon: Icon, text } = describeAction(entry)
        return (
          <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-500">
              <Icon size={13} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-ink-800">{text}</div>
              <div className="text-xs text-ink-400">{timeAgo(entry.created_at)}</div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
