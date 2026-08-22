import { Clock } from 'lucide-react'

export function IdleWarningModal({
  secondsLeft,
  onStaySignedIn,
  onSignOut,
}: {
  secondsLeft: number
  onStaySignedIn: () => void
  onSignOut: () => void
}) {
  const minutes = Math.floor(Math.max(secondsLeft, 0) / 60)
  const seconds = Math.max(secondsLeft, 0) % 60

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 backdrop-blur-sm">
      <div className="w-80 rounded-lg border border-ink-100 bg-white p-5 shadow-2xl">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-500">
          <Clock size={18} />
        </div>
        <div className="mb-1 font-display text-sm font-semibold text-ink-900">Still there?</div>
        <p className="mb-4 text-sm text-ink-500">
          You'll be signed out in{' '}
          <span className="font-medium text-ink-900">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>{' '}
          due to inactivity, to keep your account secure.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onStaySignedIn}
            className="flex-1 rounded-md bg-signal-600 py-2 text-sm font-medium text-white transition-colors hover:bg-signal-500"
          >
            Stay signed in
          </button>
          <button
            onClick={onSignOut}
            className="rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-ink-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
