// A small signature touch: every person/customer gets a stable color drawn
// from the same palette as the rest of the UI, derived from their name —
// so the same person always looks the same at a glance across the whole
// app, without storing a color anywhere.
const PALETTE = [
  { bg: '#0f6e56', fg: '#ffffff' }, // signal
  { bg: '#6d4fc2', fg: '#ffffff' }, // violet
  { bg: '#ba7517', fg: '#ffffff' }, // amber
  { bg: '#223350', fg: '#ffffff' }, // ink-700
  { bg: '#a32d2d', fg: '#ffffff' }, // red
  { bg: '#1d9e75', fg: '#ffffff' }, // signal-400
]

function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const SIZE_CLASSES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
}

export function Avatar({ name, size = 'sm' }: { name: string; size?: keyof typeof SIZE_CLASSES }) {
  const label = name?.trim() || '?'
  const color = PALETTE[hashName(label) % PALETTE.length]
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-semibold ${SIZE_CLASSES[size]}`}
      style={{ backgroundColor: color.bg, color: color.fg }}
      aria-hidden="true"
    >
      {initials(label)}
    </div>
  )
}
