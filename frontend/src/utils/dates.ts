// WhatsApp-style date separator label: "Today", "Yesterday", or a full
// date for anything older — exactly what appears as the centered pill
// between messages from different days.
export function formatDateSeparator(date: Date): string {
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'

  // Within the same year, WhatsApp drops the year for brevity.
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: sameYear ? undefined : 'numeric',
  })
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
