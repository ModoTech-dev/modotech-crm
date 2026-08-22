import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { IdleWarningModal } from '../components/IdleWarningModal'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { useAuth } from '../context/AuthContext'

export function AppLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleTimeout = () => {
    logout()
    navigate('/login', { state: { timedOut: true } })
  }

  const { warning, secondsLeft, staySignedIn } = useIdleTimeout(handleTimeout)

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-50 text-ink-900">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
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
