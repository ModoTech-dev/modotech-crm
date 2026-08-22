import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import {
  LayoutDashboard, Inbox, Users, UserPlus, Megaphone, FileText,
  BarChart3, UserCog, Building2, Settings, LogOut, Wifi, Search,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Avatar } from './Avatar'
import { GlobalSearchModal } from './GlobalSearchModal'
import type { Role } from '../types'

// Mirrors the backend's own permission tiers exactly (see
// apps/accounts/permissions.py) — a role only sees a nav item here if
// it would actually be let in, so there's no dead-end 403 behind it.
// 0 = any authenticated user, 1 = manager+, 2 = admin+, 3 = super admin only.
// Django superusers always carry role=SUPER_ADMIN in the database (the
// backend syncs this automatically on save), so checking `role` alone
// here is sufficient — no separate is_superuser flag needed.
function roleTier(role?: Role): number {
  if (role === 'SUPER_ADMIN') return 3
  if (role === 'ADMIN') return 2
  if (role === 'MANAGER') return 1
  return 0
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true, icon: LayoutDashboard, minTier: 0 },
  { to: '/inbox', label: 'Inbox', icon: Inbox, minTier: 0 },
  { to: '/customers', label: 'Customers', icon: Users, minTier: 0 },
  { to: '/leads', label: 'Leads', icon: UserPlus, minTier: 0 },
  { to: '/reports', label: 'Reports', icon: BarChart3, minTier: 1 },
  { to: '/broadcasts', label: 'Broadcasts', icon: Megaphone, minTier: 2 },
  { to: '/templates', label: 'Templates', icon: FileText, minTier: 2 },
  { to: '/settings', label: 'Settings', icon: Settings, minTier: 2 },
  { to: '/agents', label: 'Agents', icon: UserCog, minTier: 3 },
  { to: '/departments', label: 'Departments', icon: Building2, minTier: 3 },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const tier = roleTier(user?.role)
  const visibleItems = NAV_ITEMS.filter((item) => tier >= item.minTier)
  const [showSearch, setShowSearch] = useState(false)

  return (
    <>
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-950 text-ink-100">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-signal-600 text-white">
          <Wifi size={16} strokeWidth={2.5} />
        </div>
        <div className="font-display text-sm font-semibold tracking-wide">Modotech CRM</div>
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={() => setShowSearch(true)}
          className="flex w-full items-center gap-2 rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-xs text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
        >
          <Search size={14} />
          Search contacts, chats…
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-ink-800 text-white'
                  : 'text-ink-400 hover:bg-ink-900 hover:text-ink-100'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={clsx(
                    'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-signal-400 transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <item.icon size={16} strokeWidth={2} className="shrink-0" />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-ink-800 px-4 py-4">
        <div className="mb-3 flex items-center gap-2.5">
          <Avatar name={user?.full_name || user?.email || '?'} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-ink-100">
              {user?.full_name || user?.email}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-ink-500">{user?.role}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-100"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>

    {showSearch && <GlobalSearchModal onClose={() => setShowSearch(false)} />}
    </>
  )
}
