import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { CircuitBackground } from '../components/CircuitBackground'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const timedOut = (location.state as { timedOut?: boolean } | null)?.timedOut
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/')
    } catch {
      setError('Invalid email or password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-ink-950">
      <CircuitBackground />

      {/* Radial vignette so the animation stays ambient at the edges and
          never competes with the card's contrast — legibility first. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at center, rgba(11,18,32,0.55) 0%, rgba(11,18,32,0.92) 68%)' }}
      />

      <div className="relative z-10 flex flex-col items-center px-4">
        <div className="w-80 overflow-hidden rounded-xl border border-ink-800 shadow-2xl">
          {/* Signature brand band — the same blue-to-red gradient used as
              the Dashboard's own accent stripe, cut on a diagonal so the
              card reads as one connected shape rather than a stacked
              header. This is the one bold move on the page; everything
              else stays quiet so it doesn't compete. */}
          <div
            className="relative flex flex-col items-center bg-gradient-to-br from-brand-600 via-brand-500 to-red-500 pb-10 pt-6"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 62%, 0 100%)' }}
          >
            <div className="mb-2 rounded-lg bg-white p-2 shadow-md">
              <img src="/logo.png" alt="" className="h-8 w-auto" />
            </div>
            <div className="font-display text-base font-semibold tracking-wide text-white">
              Modotech Softwares
            </div>
          </div>

          <form onSubmit={handleSubmit} className="-mt-4 bg-ink-900 px-6 pb-6 pt-2">
            {timedOut && (
              <div className="mb-4 flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-500">
                <Clock size={13} className="shrink-0" />
                You were signed out after 15 minutes of inactivity.
              </div>
            )}

            <div className="mb-5 text-center text-xs uppercase tracking-widest text-ink-500">
              Sign in to your CRM
            </div>

            <label className="mb-1 block text-xs text-ink-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="mb-4 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
            />

            <label className="mb-1 block text-xs text-ink-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mb-4 w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
            />

            {error && (
              <div className="mb-3 flex items-center gap-1.5 text-xs text-red-500">
                <AlertCircle size={13} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-signal-600 py-2 text-sm font-medium text-white transition-colors hover:bg-signal-500 disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <div className="mt-5 text-[11px] text-ink-600">WhatsApp CRM · Modotech Softwares</div>
      </div>
    </div>
  )
}
