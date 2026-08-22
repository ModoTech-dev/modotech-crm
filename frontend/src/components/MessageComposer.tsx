import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Send, AlertTriangle, MapPin, Paperclip, X, FileText } from 'lucide-react'
import { LocationShareModal } from './LocationShareModal'

const MAX_FILE_SIZE = 16 * 1024 * 1024 // matches the backend's own cap

export function MessageComposer({
  disabled,
  disabledReason,
  onSend,
  onSendLocation,
  onSendFile,
}: {
  disabled: boolean
  disabledReason?: string
  onSend: (content: string) => Promise<void>
  onSendLocation: (location: { latitude: number; longitude: number; name: string; address: string }) => Promise<void>
  onSendFile: (file: File, caption: string) => Promise<void>
}) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!pendingFile && !content.trim()) return
    setSending(true)
    setError('')
    try {
      if (pendingFile) {
        await onSendFile(pendingFile, content.trim())
        setPendingFile(null)
      } else {
        await onSend(content.trim())
      }
      setContent('')
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.response?.data?.file?.[0] || err?.response?.data?.error
      setError(typeof detail === 'string' ? detail : 'Failed to send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again later
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setError(`"${file.name}" is too large — max ${MAX_FILE_SIZE / (1024 * 1024)}MB.`)
      return
    }
    setError('')
    setPendingFile(file)
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-ink-100 bg-white p-3">
      {disabled && disabledReason && (
        <div className="mb-2 flex items-start gap-1.5 rounded-md bg-amber-100 px-3 py-1.5 text-xs text-amber-500">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {disabledReason}
        </div>
      )}
      {error && (
        <div className="mb-2 flex items-start gap-1.5 rounded-md bg-red-100 px-3 py-1.5 text-xs text-red-500">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {pendingFile && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-700">
          <FileText size={14} className="shrink-0 text-ink-400" />
          <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
          <span className="shrink-0 text-ink-400">{(pendingFile.size / 1024).toFixed(0)}KB</span>
          <button
            type="button"
            onClick={() => setPendingFile(null)}
            className="shrink-0 text-ink-400 hover:text-red-500"
            aria-label="Remove attachment"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          aria-label="Attach a file"
          title="Attach a file (image, document, audio, video)"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink-200 text-ink-500 transition-colors hover:bg-ink-50 disabled:opacity-50"
        >
          <Paperclip size={15} />
        </button>
        <button
          type="button"
          onClick={() => setShowLocationModal(true)}
          disabled={disabled}
          aria-label="Share location"
          title="Share a location"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink-200 text-ink-500 transition-colors hover:bg-ink-50 disabled:opacity-50"
        >
          <MapPin size={15} />
        </button>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={disabled}
          placeholder={disabled ? 'Outside the 24h window — send a template instead' : pendingFile ? 'Add a caption (optional)…' : 'Type a message…'}
          rows={2}
          className="flex-1 resize-none rounded-md border border-ink-200 px-3 py-2 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20 disabled:bg-ink-50"
        />
        <button
          type="submit"
          disabled={disabled || sending || (!pendingFile && !content.trim())}
          aria-label="Send message"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-signal-600 text-white transition-colors hover:bg-signal-500 disabled:opacity-50"
        >
          <Send size={15} />
        </button>
      </div>

      {showLocationModal && (
        <LocationShareModal
          onClose={() => setShowLocationModal(false)}
          onSend={async (location) => {
            await onSendLocation(location)
            setShowLocationModal(false)
          }}
        />
      )}
    </form>
  )
}
