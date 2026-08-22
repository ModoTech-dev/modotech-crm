import { useEffect, useState, type FormEvent } from 'react'
import { FileText, Plus, AlertTriangle, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import { Header } from '../components/Header'
import { EmptyState } from '../components/EmptyState'
import { SkeletonRows } from '../components/Skeleton'
import { useToast } from '../context/ToastContext'
import { parseFieldErrors } from '../utils/errors'
import type { MessageTemplate } from '../types'

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'text-ink-500 bg-ink-100',
  PENDING: 'text-amber-500 bg-amber-100',
  APPROVED: 'text-signal-600 bg-signal-100',
  REJECTED: 'text-red-500 bg-red-100',
}

export function TemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'UTILITY', language: 'en', body: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const { showToast } = useToast()

  function load() {
    api.get('/whatsapp/templates/').then((res) => setTemplates(res.data.results ?? res.data))
  }
  useEffect(load, [])

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.post('/whatsapp/templates/sync/')
      showToast(`Synced: ${res.data.created} new, ${res.data.updated} updated`)
      load()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Sync failed — check your WhatsApp connection.', 'error')
    } finally {
      setSyncing(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    try {
      await api.post('/whatsapp/templates/', form)
      showToast(`"${form.name}" saved as draft`)
      setForm({ name: '', category: 'UTILITY', language: 'en', body: '' })
      setShowForm(false)
      load()
    } catch (err: any) {
      const errors = parseFieldErrors(err.response?.data)
      setFieldErrors(errors)
      showToast(Object.values(errors).join(' ') || 'Failed to create template.', 'error')
    }
  }

  async function updateStatus(template: MessageTemplate, status: string) {
    try {
      await api.patch(`/whatsapp/templates/${template.id}/`, { status })
      setTemplates((prev) => prev?.map((t) => (t.id === template.id ? { ...t, status: status as MessageTemplate['status'] } : t)) ?? null)
      showToast(`"${template.name}" marked as ${status.toLowerCase()}`)
    } catch {
      showToast('Failed to update status', 'error')
    }
  }

  return (
    <>
      <Header
        title="Templates"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-md border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync from 360dialog'}
            </button>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-1.5 rounded-md bg-signal-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-signal-500"
            >
              <Plus size={14} />
              {showForm ? 'Cancel' : 'New template'}
            </button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-start gap-1.5 rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-500">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Use "Sync from 360dialog" to pull real approval status directly — this is the reliable way to
          know what's actually approved. Creating a template with the button below only saves a local
          record for reference and does NOT submit anything to Meta; actual submission always happens
          through 360dialog Hub.
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-ink-100 bg-white p-4">
            <label className="flex flex-col gap-1 text-xs text-ink-500">
              Name (snake_case, must be unique)
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={`rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 ${fieldErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-ink-200 focus:border-signal-500 focus:ring-signal-500/20'}`} />
              {fieldErrors.name && <span className="text-red-500">{fieldErrors.name}</span>}
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-500">
              Category
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20">
                <option value="UTILITY">Utility</option>
                <option value="MARKETING">Marketing</option>
                <option value="AUTHENTICATION">Authentication</option>
              </select>
            </label>
            <label className="col-span-full flex flex-col gap-1 text-xs text-ink-500">
              Body (use {'{{1}}'}, {'{{2}}'}, etc. — WhatsApp requires numbered placeholders, not named ones)
              <textarea required rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                className={`rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 ${fieldErrors.body ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-ink-200 focus:border-signal-500 focus:ring-signal-500/20'}`} />
              {fieldErrors.body && <span className="text-red-500">{fieldErrors.body}</span>}
            </label>
            <div className="col-span-full flex items-center gap-3">
              <button type="submit" className="rounded-md bg-signal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-signal-500">
                Save draft
              </button>
              {fieldErrors._general && <span className="text-xs text-red-500">{fieldErrors._general}</span>}
            </div>
          </form>
        )}

        {templates && templates.length === 0 ? (
          <EmptyState icon={FileText} title="No templates yet" description="Create a template above — you'll need it approved in Meta before sending broadcasts." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-ink-100 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Body</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {!templates ? (
                  <SkeletonRows rows={4} cols={4} />
                ) : (
                  templates.map((t) => (
                    <tr key={t.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                      <td className="px-4 py-2.5 font-medium text-ink-900">{t.name}</td>
                      <td className="px-4 py-2.5 text-ink-600">{t.category}</td>
                      <td className="max-w-md truncate px-4 py-2.5 text-ink-600">{t.body}</td>
                      <td className="px-4 py-2.5">
                        <select
                          value={t.status}
                          onChange={(e) => updateStatus(t, e.target.value)}
                          className={`rounded-md border-0 px-2 py-1 text-xs font-medium outline-none ${STATUS_STYLES[t.status]}`}
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="PENDING">Pending Meta review</option>
                          <option value="APPROVED">Approved</option>
                          <option value="REJECTED">Rejected</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
