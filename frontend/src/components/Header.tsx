import { type ReactNode } from 'react'

export function Header({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-ink-100 bg-white px-6">
      <h1 className="text-sm font-medium text-ink-900">{title}</h1>
      {actions}
    </header>
  )
}
