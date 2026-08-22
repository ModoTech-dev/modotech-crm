import { formatDateSeparator } from '../utils/dates'

export function DateSeparator({ date }: { date: Date }) {
  return (
    <div className="my-3 flex items-center justify-center">
      <span className="rounded-full bg-ink-100 px-3 py-1 text-[11px] font-medium text-ink-500">
        {formatDateSeparator(date)}
      </span>
    </div>
  )
}
