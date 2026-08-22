import { useState } from 'react'
import clsx from 'clsx'
import { MapPin, ExternalLink, FileText, Download, Trash2, Ban, Smartphone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import type { Message } from '../types'

export function MessageBubble({
  message,
  onDeleted,
}: {
  message: Message
  onDeleted?: (updated: Message) => void
}) {
  const { user } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fromCustomer = message.sender_type === 'CUSTOMER'
  const isPhoneEcho = message.sender_type === 'PHONE'
  const isMine = message.sender_type === 'AGENT' && message.sender_user === user?.id
  const hasLocation =
    message.message_type === 'LOCATION' &&
    typeof message.metadata?.latitude === 'number' &&
    typeof message.metadata?.longitude === 'number'
  const hasMedia = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(message.message_type) && message.media_url

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await api.delete(`/conversations/${message.conversation}/messages/${message.id}/`)
      onDeleted?.(res.data)
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  if (message.is_deleted) {
    return (
      <div className={clsx('flex', fromCustomer ? 'justify-start' : 'justify-end')}>
        <div className="flex max-w-md items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-sm italic text-ink-400">
          <Ban size={13} className="shrink-0" />
          Removed from CRM
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('group flex items-end gap-1.5', fromCustomer ? 'justify-start' : 'justify-end')}>
      {isMine && (
        <div className="mb-1 opacity-0 transition-opacity group-hover:opacity-100">
          {confirming ? (
            <div className="flex items-center gap-1 rounded-md border border-ink-200 bg-white px-1.5 py-1 shadow-sm">
              <span className="whitespace-nowrap text-[10px] text-ink-500">Remove from CRM only?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? '…' : 'Yes'}
              </button>
              <button onClick={() => setConfirming(false)} className="text-[10px] text-ink-400 hover:text-ink-700">
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              aria-label="Remove message"
              title="Remove from CRM (does not delete it from the customer's phone)"
              className="rounded p-1 text-ink-300 hover:bg-ink-100 hover:text-red-500"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}

      <div
        className={clsx(
          'max-w-md rounded-lg px-3 py-2 text-sm',
          fromCustomer ? 'bg-white text-ink-900' : isPhoneEcho ? 'bg-violet-100 text-ink-900' : 'bg-signal-600 text-white'
        )}
      >
        {isPhoneEcho && (
          <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-violet-500">
            <Smartphone size={11} />
            Sent from phone — not through the CRM
          </div>
        )}
        {hasLocation ? (
          <LocationCard message={message} light={!fromCustomer && !isPhoneEcho} />
        ) : hasMedia ? (
          <MediaContent message={message} light={!fromCustomer && !isPhoneEcho} />
        ) : (
          <div className="whitespace-pre-wrap">{message.content}</div>
        )}
        <div className={clsx('mt-1 text-right text-[10px]', fromCustomer || isPhoneEcho ? 'text-ink-400' : 'text-signal-100')}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {!fromCustomer && !isPhoneEcho && ` · ${message.status.toLowerCase()}`}
        </div>
      </div>
    </div>
  )
}

function MediaContent({ message, light }: { message: Message; light: boolean }) {
  const url = message.media_url as string
  const filename = url.split('/').pop() || 'file'

  if (message.message_type === 'IMAGE') {
    return (
      <div>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt={message.content || 'Image'} className="max-h-64 w-full rounded-md object-cover" loading="lazy" />
        </a>
        {message.content && <div className="mt-1.5 whitespace-pre-wrap">{message.content}</div>}
      </div>
    )
  }

  if (message.message_type === 'VIDEO') {
    return (
      <div>
        <video src={url} controls className="max-h-64 w-full rounded-md" />
        {message.content && <div className="mt-1.5 whitespace-pre-wrap">{message.content}</div>}
      </div>
    )
  }

  if (message.message_type === 'AUDIO') {
    return (
      <div>
        <audio src={url} controls className="w-full" style={{ minWidth: '240px' }} />
        {message.content && <div className="mt-1.5 whitespace-pre-wrap">{message.content}</div>}
      </div>
    )
  }

  // DOCUMENT
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        'flex items-center gap-2 rounded-md px-2 py-2',
        light ? 'bg-signal-500' : 'bg-ink-50'
      )}
    >
      <FileText size={20} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{message.content || filename}</span>
      <Download size={14} className="shrink-0 opacity-70" />
    </a>
  )
}

function LocationCard({ message, light }: { message: Message; light: boolean }) {
  const { latitude, longitude, name, address } = message.metadata || {}
  const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`
  // A static map preview needs no API key — just an OSM export image
  // centered on the pin, small enough to sit inline in a chat bubble.
  const previewUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=280x140&markers=${latitude},${longitude},red-pushpin`

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-md border border-black/10"
    >
      <img src={previewUrl} alt="Location map preview" className="h-32 w-full object-cover" loading="lazy" />
      <div className={clsx('flex items-center gap-2 px-2 py-1.5', light ? 'bg-signal-500' : 'bg-ink-50')}>
        <MapPin size={13} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{name || 'Shared location'}</div>
          {address && <div className={clsx('truncate text-[11px]', light ? 'text-signal-100' : 'text-ink-500')}>{address}</div>}
        </div>
        <ExternalLink size={12} className="shrink-0 opacity-70" />
      </div>
    </a>
  )
}
