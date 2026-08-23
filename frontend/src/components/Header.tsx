import { type ReactNode } from 'react'

export function Header({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="flex shrink-0 flex-col gap-2 border-b border-ink-100 bg-white px-4 py-3 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0">
      <h1 className="text-sm font-medium text-ink-900">{title}</h1>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
