import type { LucideIcon } from 'lucide-react'

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
}: {
  label: string
  value: number | string
  icon?: LucideIcon
  tone?: keyof typeof TONE_STYLES
}) {
  const styles = TONE_STYLES[tone]
  return (
    <div className={`rounded-lg border p-4 transition-shadow hover:shadow-sm ${styles.card}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-ink-600">{label}</div>
        {Icon && (
          <div className={`flex h-7 w-7 items-center justify-center rounded-md ${styles.icon}`}>
            <Icon size={14} strokeWidth={2} />
          </div>
        )}
      </div>
      <div className={`mt-2 font-display text-2xl font-bold ${styles.value}`}>{value}</div>
    </div>
  )
}
