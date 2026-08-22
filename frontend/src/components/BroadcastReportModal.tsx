import { useEffect, useState } from 'react'
import { X, Download, AlertTriangle, Lock } from 'lucide-react'
import { api } from '../api/client'
import { SkeletonRows } from './Skeleton'
import type { Broadcast } from '../types'

interface Recipient {
  id: string
  customer_name: string
  customer_whatsapp_number: string
  status: string
  error: string
  likely_not_on_whatsapp: boolean
}

export function BroadcastReportModal({ broadcast, onClose }: { broadcast: Broadcast; onClose: () => void }) {
  const [recipients, setRecipients] = useState<Recipient[] | null>(null)
  const [showOnlyNonWhatsApp, setShowOnlyNonWhatsApp] = useState(false)

  useEffect(() => {
    api.get(`/whatsapp/broadcasts/${broadcast.id}/recipients/`).then((res) => setRecipients(res.data))
  }, [broadcast.id])

  const nonWhatsAppCount = recipients?.filter((r) => r.likely_not_on_whatsapp).length ?? 0
  const shown = recipients?.filter((r) => !showOnlyNonWhatsApp || r.likely_not_on_whatsapp)

  function downloadCsv() {
    const rows = recipients?.filter((r) => r.likely_not_on_whatsapp) || []
    const csv = [
      'Name,WhatsApp Number,Error',
      ...rows.map((r) => `"${r.customer_name}","${r.customer_whatsapp_number}","${r.error.replace(/"/g, '""')}"`),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${broadcast.name}-non-whatsapp-contacts.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-ink-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div className="font-display text-sm font-semibold text-ink-900">{broadcast.name} — delivery report</div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {nonWhatsAppCount > 0 && (
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-amber-100 px-5 py-2.5 text-xs text-amber-500">
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={13} />
              {nonWhatsAppCount} contact{nonWhatsAppCount !== 1 ? 's' : ''} likely aren't on WhatsApp — worth reaching another way.
            </span>
            <div className="flex shrink-0 items-center gap-3">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={showOnlyNonWhatsApp} onChange={(e) => setShowOnlyNonWhatsApp(e.target.checked)} />
                Show only these
              </label>
              <button onClick={downloadCsv} className="flex items-center gap-1 font-medium hover:underline">
                <Download size={12} />
                Download CSV
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">WhatsApp</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Detail</th>
              </tr>
            </thead>
            <tbody>
              {!recipients ? (
                <SkeletonRows rows={5} cols={4} />
              ) : (
                shown?.map((r) => (
                  <tr key={r.id} className={`border-b border-ink-100 last:border-0 ${r.likely_not_on_whatsapp ? 'bg-amber-50' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-ink-900">{r.customer_name || '—'}</td>
                    <td className="px-4 py-2.5 text-ink-600">
                      <span className="inline-flex items-center gap-1">
                        {r.customer_whatsapp_number}
                        {r.customer_whatsapp_number.includes('*') && <Lock size={10} className="text-ink-400" />}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-600">{r.status}</td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-xs text-ink-500" title={r.error}>
                      {r.likely_not_on_whatsapp ? (
                        <span className="font-medium text-amber-500">Not on WhatsApp (likely)</span>
                      ) : (
                        r.error || '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
