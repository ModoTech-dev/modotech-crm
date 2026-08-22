import { Header } from '../components/Header'

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <Header title={title} />
      <div className="flex flex-1 items-center justify-center text-sm text-ink-400">
        {title} — coming in a later phase.
      </div>
    </>
  )
}
