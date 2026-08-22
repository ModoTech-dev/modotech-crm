import { useState, type FormEvent } from 'react'
import { MapPin, X, Link2, CheckCircle2 } from 'lucide-react'
import { api } from '../api/client'

export function LocationShareModal({
  onClose,
  onSend,
}: {
  onClose: () => void
  onSend: (location: { latitude: number; longitude: number; name: string; address: string }) => Promise<void>
}) {
  const [link, setLink] = useState('')
  const [parsed, setParsed] = useState<{ latitude: number; longitude: number; name: string } | null>(null)
  const [name, setName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function handleParse(e: FormEvent) {
    e.preventDefault()
    if (!link.trim()) return
    setParsing(true)
    setError('')
    setParsed(null)
    try {
      const res = await api.post('/parse-maps-link/', { url: link.trim() })
      setParsed(res.data)
      setName(res.data.name || '')
    } catch (err: any) {
      setError(err?.response?.data?.url?.[0] || "Couldn't read that link.")
    } finally {
      setParsing(false)
    }
  }

  async function handleSend() {
    if (!parsed) return
    setSending(true)
    setError('')
    try {
      await onSend({ latitude: parsed.latitude, longitude: parsed.longitude, name, address: '' })
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to send location.')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg border border-ink-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-signal-100 text-signal-600">
              <MapPin size={16} />
            </div>
            <div className="font-display text-sm font-semibold text-ink-900">Share a location</div>
          </div>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <form onSubmit={handleParse}>
            <label className="flex flex-col gap-1 text-xs text-ink-500">
              Paste a Google Maps link
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    value={link}
                    onChange={(e) => { setLink(e.target.value); setParsed(null) }}
                    placeholder="https://maps.google.com/... or maps.app.goo.gl/..."
                    className="w-full rounded-md border border-ink-200 py-1.5 pl-7 pr-2 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={parsing || !link.trim()}
                  className="shrink-0 rounded-md border border-ink-200 px-3 py-1.5 text-sm text-ink-600 transition-colors hover:bg-ink-50 disabled:opacity-50"
                >
                  {parsing ? '…' : 'Find'}
                </button>
              </div>
            </label>
            <p className="mt-1 text-[11px] text-ink-400">
              Open the place in Google Maps, tap Share, and copy the link here — same as sharing it anywhere else.
            </p>
          </form>

          {error && <div className="rounded-md bg-red-100 px-3 py-2 text-xs text-red-500">{error}</div>}

          {parsed && (
            <div className="space-y-3 rounded-md border border-signal-100 bg-signal-100/40 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-signal-600">
                <CheckCircle2 size={13} />
                Location found — {parsed.latitude.toFixed(5)}, {parsed.longitude.toFixed(5)}
              </div>
              <label className="flex flex-col gap-1 text-xs text-ink-500">
                Name to show
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Modotech Softwares"
                  className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
                />
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-ink-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!parsed || sending}
            className="rounded-md bg-signal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-signal-500 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send location'}
          </button>
        </div>
      </div>
    </div>
  )
}
