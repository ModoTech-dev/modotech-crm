import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu, Wifi } from 'lucide-react'
import { Sidebar } from '../components/Sidebar'
import { IdleWarningModal } from '../components/IdleWarningModal'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { useAuth } from '../context/AuthContext'

export function AppLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleTimeout = () => {
    logout()
    navigate('/login', { state: { timedOut: true } })
  }

  const { warning, secondsLeft, staySignedIn } = useIdleTimeout(handleTimeout)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-50 text-ink-900">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-only top bar — the sidebar is hidden by default below the
            md breakpoint, so this is the persistent, always-visible way to
            reach it. Desktop never renders this; the sidebar is already
            always visible there. */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-ink-100 bg-white px-3 md:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-50"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-signal-600 text-white">
              <Wifi size={12} strokeWidth={2.5} />
            </div>
            <div className="font-display text-xs font-semibold text-ink-900">Modotech CRM</div>
          </div>
        </div>
        <Outlet />
      </div>
      {warning && (
        <IdleWarningModal
          secondsLeft={secondsLeft}
          onStaySignedIn={staySignedIn}
          onSignOut={handleTimeout}
        />
      )}
    </div>
  )
}
