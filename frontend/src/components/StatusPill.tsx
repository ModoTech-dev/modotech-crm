import clsx from 'clsx'

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-signal-100 text-signal-600',
  PENDING: 'bg-amber-100 text-amber-500',
  RESOLVED: 'bg-ink-100 text-ink-500',
  CLOSED: 'bg-ink-100 text-ink-400',
  LEAD: 'bg-signal-100 text-signal-600',
  ACTIVE: 'bg-signal-100 text-signal-600',
  SUSPENDED: 'bg-red-100 text-red-500',
  INACTIVE: 'bg-ink-100 text-ink-400',
  PROSPECT: 'bg-violet-100 text-violet-500',
  URGENT: 'bg-red-100 text-red-500',
  HIGH: 'bg-amber-100 text-amber-500',
  DRAFT: 'bg-ink-100 text-ink-500',
  SENDING: 'bg-amber-100 text-amber-500',
  COMPLETED: 'bg-signal-100 text-signal-600',
  FAILED: 'bg-red-100 text-red-500',
  APPROVED: 'bg-signal-100 text-signal-600',
  PENDING_REVIEW: 'bg-amber-100 text-amber-500',
  REJECTED: 'bg-red-100 text-red-500',
}

const DOT_STYLES: Record<string, string> = {
  OPEN: 'bg-signal-500', PENDING: 'bg-amber-500', RESOLVED: 'bg-ink-400', CLOSED: 'bg-ink-400',
  LEAD: 'bg-signal-500', ACTIVE: 'bg-signal-500', SUSPENDED: 'bg-red-500', INACTIVE: 'bg-ink-400',
  PROSPECT: 'bg-violet-500', URGENT: 'bg-red-500', HIGH: 'bg-amber-500', DRAFT: 'bg-ink-400',
  SENDING: 'bg-amber-500', COMPLETED: 'bg-signal-500', FAILED: 'bg-red-500', APPROVED: 'bg-signal-500',
  REJECTED: 'bg-red-500',
}

export function StatusPill({ value, dot = true }: { value: string; dot?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[value] ?? 'bg-ink-100 text-ink-500')}>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', DOT_STYLES[value] ?? 'bg-ink-400')} />}
      {value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')}
    </span>
  )
}
