import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-ink-200 px-6 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-50 text-ink-400">
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <div>
        <div className="font-display text-sm font-semibold text-ink-900">{title}</div>
        {description && <div className="mt-1 max-w-xs text-sm text-ink-500">{description}</div>}
      </div>
      {action}
    </div>
  )
}
