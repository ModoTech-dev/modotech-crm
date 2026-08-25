import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'

const TONE_STYLES = {
  default: { card: 'bg-brand-50 border-brand-100', icon: 'bg-white/80 text-brand-500', value: 'text-ink-900' },
  accent: { card: 'bg-brand-100 border-brand-200', icon: 'bg-white text-brand-600', value: 'text-ink-900' },
  warn: { card: 'bg-amber-100 border-amber-100', icon: 'bg-white text-amber-500', value: 'text-ink-900' },
  urgent: { card: 'bg-red-100 border-red-100', icon: 'bg-white text-red-500', value: 'text-ink-900' },
}

export function DashboardCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  clickable = false,
  onClick,
}: {
  label: string
  value: number | string
  icon?: LucideIcon
  tone?: keyof typeof TONE_STYLES
  /** Adds a hover cue (border, shadow, chevron) signaling this tile
   * links somewhere — vs. the plain stats that don't, like today's
   * message counts, which have no single filtered view to link to. */
  clickable?: boolean
  onClick?: () => void
}) {
  const styles = TONE_STYLES[tone]
  return (
    <div
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick?.() : undefined}
      className={`group relative rounded-lg border p-4 transition-all ${styles.card} ${
        clickable ? 'cursor-pointer hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-md' : 'hover:shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-ink-600">{label}</div>
        {Icon && (
          <div className={`flex h-7 w-7 items-center justify-center rounded-md ${styles.icon}`}>
            <Icon size={14} strokeWidth={2} />
          </div>
        )}
      </div>
      <div className={`mt-2 font-display text-2xl font-bold ${styles.value}`}>{value}</div>
      {clickable && (
        <ChevronRight
          size={14}
          className="absolute bottom-3 right-3 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100"
        />
      )}
    </div>
  )
}
