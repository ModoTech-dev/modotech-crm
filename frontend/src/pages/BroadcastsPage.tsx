import { useEffect, useState, type FormEvent } from 'react'
import { Megaphone, Plus, AlertTriangle, Send, FileText } from 'lucide-react'
import { api } from '../api/client'
import { Header } from '../components/Header'
import { StatusPill } from '../components/StatusPill'
import { EmptyState } from '../components/EmptyState'
import { SkeletonRows } from '../components/Skeleton'
import { BroadcastReportModal } from '../components/BroadcastReportModal'
import { useToast } from '../context/ToastContext'
import { parseFieldErrors } from '../utils/errors'
import type { Broadcast, MessageTemplate } from '../types'

const CUSTOMER_STATUSES = ['', 'LEAD', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'PROSPECT']

export function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[] | null>(null)
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', template: '', customer_status_filter: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [forbidden, setForbidden] = useState(false)
  const [reportBroadcast, setReportBroadcast] = useState<Broadcast | null>(null)
  const { showToast } = useToast()

  function load() {
    api
      .get('/whatsapp/broadcasts/')
      .then((res) => setBroadcasts(res.data.results ?? res.data))
      .catch((err) => {
        if (err.response?.status === 403) setForbidden(true)
      })
  }
  useEffect(load, [])
  useEffect(() => {
    api.get('/whatsapp/templates/').then((res) => setTemplates((res.data.results ?? res.data).filter((t: MessageTemplate) => t.status === 'APPROVED')))
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    try {
      await api.post('/whatsapp/broadcasts/', form)
      showToast(`"${form.name}" saved as draft`)
      setForm({ name: '', template: '', customer_status_filter: '' })
      setShowForm(false)
      load()
    } catch (err: any) {
      const errors = parseFieldErrors(err.response?.data)
      setFieldErrors(errors)
      showToast(Object.values(errors).join(' ') || 'Failed to create broadcast.', 'error')
    }
  }

  async function handleSend(broadcast: Broadcast) {
    if (!confirm(`Send "${broadcast.name}" to ${broadcast.recipient_count} customers now? This can't be undone.`)) return
    try {
      await api.post(`/whatsapp/broadcasts/${broadcast.id}/send/`)
      showToast(`"${broadcast.name}" is sending`)
      load()
    } catch {
      showToast('Failed to start sending', 'error')
    }
  }

  return (
    <>
      <Header
        title="Broadcasts"
        actions={
          !forbidden && (
            <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1.5 rounded-md bg-signal-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-signal-500">
              <Plus size={14} />
              {showForm ? 'Cancel' : 'New broadcast'}
            </button>
          )
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {forbidden ? (
          <EmptyState icon={Megaphone} title="Restricted" description="Broadcasts are available to admins only." />
        ) : (
          <>
            {templates.length === 0 && (
              <div className="mb-4 flex items-start gap-1.5 rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-500">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                No APPROVED templates yet — broadcasts can only send templates that Meta has approved.
                Create one under Templates, then get it approved in Meta Business Manager.
              </div>
            )}

            {showForm && (
              <form onSubmit={handleCreate} className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-ink-100 bg-white p-4 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs text-ink-500">
                  Name
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={`rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 ${fieldErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-ink-200 focus:border-signal-500 focus:ring-signal-500/20'}`} />
                  {fieldErrors.name && <span className="text-red-500">{fieldErrors.name}</span>}
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-500">
                  Template (approved only)
                  <select required value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })}
                    className={`rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 ${fieldErrors.template ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-ink-200 focus:border-signal-500 focus:ring-signal-500/20'}`}>
                    <option value="">Select…</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {fieldErrors.template && <span className="text-red-500">{fieldErrors.template}</span>}
                </label>
                <label className="flex flex-col gap-1 text-xs text-ink-500">
                  Target customer status
                  <select value={form.customer_status_filter} onChange={(e) => setForm({ ...form, customer_status_filter: e.target.value })}
                    className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20">
                    {CUSTOMER_STATUSES.map((s) => <option key={s} value={s}>{s || 'All customers'}</option>)}
                  </select>
                </label>
                <div className="col-span-full flex items-center gap-3">
                  <button type="submit" className="rounded-md bg-signal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-signal-500">
                    Save as draft
                  </button>
                  {fieldErrors._general && <span className="text-xs text-red-500">{fieldErrors._general}</span>}
                </div>
              </form>
            )}

            {broadcasts && broadcasts.length === 0 ? (
              <EmptyState icon={Megaphone} title="No broadcasts yet" description="Create a broadcast above to message a segment of your customers at once." />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-ink-100 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                    <tr>
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Template</th>
                      <th className="px-4 py-2.5">Recipients</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Sent / Failed</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {!broadcasts ? (
                      <SkeletonRows rows={4} cols={6} />
                    ) : (
                      broadcasts.map((b) => (
                        <tr key={b.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                          <td className="px-4 py-2.5 font-medium text-ink-900">{b.name}</td>
                          <td className="px-4 py-2.5 text-ink-600">{b.template_name}</td>
                          <td className="px-4 py-2.5 text-ink-600">{b.recipient_count}</td>
                          <td className="px-4 py-2.5"><StatusPill value={b.status} /></td>
                          <td className="px-4 py-2.5 text-ink-600">{b.sent_count} / {b.failed_count}</td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {b.status === 'DRAFT' && (
                                <button onClick={() => handleSend(b)} className="inline-flex items-center gap-1 text-xs text-signal-600 hover:underline">
                                  <Send size={11} />
                                  Send now
                                </button>
                              )}
                              {(b.status === 'COMPLETED' || b.status === 'FAILED') && (
                                <button onClick={() => setReportBroadcast(b)} className="inline-flex items-center gap-1 text-xs text-ink-500 hover:underline">
                                  <FileText size={11} />
                                  View report
                                </button>
                              )}
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

      {reportBroadcast && (
        <BroadcastReportModal broadcast={reportBroadcast} onClose={() => setReportBroadcast(null)} />
      )}
    </>
  )
}
