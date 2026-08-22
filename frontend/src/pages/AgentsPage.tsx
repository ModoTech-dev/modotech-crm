import { useEffect, useState, type FormEvent } from 'react'
import { UserPlus, UserCog, ShieldAlert } from 'lucide-react'
import { api } from '../api/client'
import { Header } from '../components/Header'
import { StatusPill } from '../components/StatusPill'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { SkeletonRows } from '../components/Skeleton'
import { useDepartments } from '../hooks/useDepartments'
import { useToast } from '../context/ToastContext'
import { parseFieldErrors } from '../utils/errors'
import { DeleteUserModal } from '../components/DeleteUserModal'
import type { Role, User } from '../types'

const ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT', 'SUPPORT', 'SALES', 'FINANCE', 'VIEWER']

export function AgentsPage() {
  const [users, setUsers] = useState<User[] | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const { showToast } = useToast()

  function load() {
    api
      .get('/users/')
      .then((res) => setUsers(res.data.results ?? res.data))
      .catch((err) => {
        if (err.response?.status === 403) setForbidden(true)
      })
  }

  useEffect(load, [])

  async function toggleActive(user: User) {
    try {
      await api.post(`/users/${user.id}/${user.is_active ? 'disable' : 'enable'}/`)
      showToast(user.is_active ? `${user.full_name || user.email} disabled` : `${user.full_name || user.email} enabled`)
      load()
    } catch {
      showToast('Failed to update user', 'error')
    }
  }

  async function handleDelete() {
    if (!deletingUser) return
    await api.delete(`/users/${deletingUser.id}/`)
    showToast(`${deletingUser.full_name || deletingUser.email} deleted`)
    setDeletingUser(null)
    load()
  }

  return (
    <>
      <Header
        title="Agents"
        actions={
          !forbidden && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-1.5 rounded-md bg-signal-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-signal-500"
            >
              <UserPlus size={14} />
              {showForm ? 'Cancel' : 'New user'}
            </button>
          )
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {forbidden ? (
          <EmptyState icon={ShieldAlert} title="Restricted" description="User management is available to admins only." />
        ) : (
          <>
            {showForm && <NewUserForm onCreated={() => { setShowForm(false); load(); showToast('User created') }} />}

            {users && users.length === 0 ? (
              <EmptyState icon={UserCog} title="No agents yet" description="Create your first agent account to start assigning conversations." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-ink-100 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                    <tr>
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Email</th>
                      <th className="px-4 py-2.5">Role</th>
                      <th className="px-4 py-2.5">Department</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {!users ? (
                      <SkeletonRows rows={5} cols={6} />
                    ) : (
                      users.map((u) => (
                        <tr key={u.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={u.full_name || u.email} size="xs" />
                              <span className="font-medium text-ink-900">{u.full_name || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-ink-600">{u.email}</td>
                          <td className="px-4 py-2.5 text-ink-600">{u.role}</td>
                          <td className="px-4 py-2.5 text-ink-600">{u.department || '—'}</td>
                          <td className="px-4 py-2.5">
                            <StatusPill value={u.is_active ? 'ACTIVE' : 'SUSPENDED'} />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button onClick={() => toggleActive(u)} className="text-xs text-ink-500 hover:text-signal-600">
                                {u.is_active ? 'Disable' : 'Enable'}
                              </button>
                              <button onClick={() => setDeletingUser(u)} className="text-xs text-ink-400 hover:text-red-500">
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {deletingUser && (
        <DeleteUserModal
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}

function NewUserForm({ onCreated }: { onCreated: () => void }) {
  const departments = useDepartments()
  const { showToast } = useToast()
  const [form, setForm] = useState({
    email: '', username: '', first_name: '', last_name: '', phone: '',
    role: 'AGENT' as Role, department: '', password: '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setSubmitting(true)
    try {
      await api.post('/users/', form)
      onCreated()
    } catch (err: any) {
      const errors = parseFieldErrors(err.response?.data)
      setFieldErrors(errors)
      showToast(Object.values(errors).join(' ') || 'Failed to create user.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-ink-100 bg-white p-4 sm:grid-cols-3">
      <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" required error={fieldErrors.email} />
      <Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} required error={fieldErrors.username} />
      <Field label="First name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} error={fieldErrors.first_name} />
      <Field label="Last name" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} error={fieldErrors.last_name} />
      <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} error={fieldErrors.phone} />
      <label className="flex flex-col gap-1 text-xs text-ink-500">
        Department
        <select
          value={form.department}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
          className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
        >
          <option value="">— none —</option>
          {departments.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-500">
        Role
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
        >
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <Field
        label="Temporary password"
        value={form.password}
        onChange={(v) => setForm({ ...form, password: v })}
        type="password"
        required
        hint="At least 10 characters"
        error={fieldErrors.password}
      />

      <div className="col-span-full flex items-center gap-3">
        <button type="submit" disabled={submitting} className="rounded-md bg-signal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-signal-500 disabled:opacity-60">
          {submitting ? 'Creating…' : 'Create user'}
        </button>
        {fieldErrors._general && <span className="text-xs text-red-500">{fieldErrors._general}</span>}
      </div>
    </form>
  )
}

function Field({ label, value, onChange, type = 'text', required = false, hint, error }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; hint?: string; error?: string
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-500">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
            : 'border-ink-200 focus:border-signal-500 focus:ring-signal-500/20'
        }`}
      />
      {error ? (
        <span className="text-red-500">{error}</span>
      ) : hint ? (
        <span className="text-ink-400">{hint}</span>
      ) : null}
    </label>
  )
}
