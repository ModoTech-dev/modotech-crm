import { useState, type FormEvent } from 'react'
import { X, Pencil } from 'lucide-react'
import { api } from '../api/client'
import type { Customer } from '../types'

const STATUS_OPTIONS = ['LEAD', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'PROSPECT']

export function CustomerEditModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer
  onClose: () => void
  onSaved: (updated: Customer) => void
}) {
  const [form, setForm] = useState({
    name: customer.name,
    email: customer.email,
    location: customer.location,
    account_number: customer.account_number,
    status: customer.status,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await api.patch(`/customers/${customer.id}/`, form)
      onSaved(res.data)
    } catch {
      setError('Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-ink-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <Pencil size={15} />
            </div>
            <div className="font-display text-sm font-semibold text-ink-900">Edit customer</div>
          </div>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="rounded-md bg-brand-50 px-3 py-1.5 text-xs text-brand-600">
            {customer.whatsapp_number} — number itself can't be changed here, only account details.
          </p>
          <label className="flex flex-col gap-1 text-xs text-ink-500">
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-500">
            Email
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email"
              className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-500">
            Location
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-500">
            Account number
            <input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })}
              className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-500">
            Status
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Customer['status'] })}
              className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {error && <div className="rounded-md bg-red-100 px-3 py-2 text-xs text-red-500">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-ink-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-md bg-signal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-signal-500 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
