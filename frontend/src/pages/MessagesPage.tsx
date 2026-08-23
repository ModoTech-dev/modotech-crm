import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, Megaphone, X, Link2, Search, UserPlus, Paperclip, FileText, Download } from 'lucide-react'
import { api } from '../api/client'
import { Header } from '../components/Header'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { useAuth } from '../context/AuthContext'
import { useOpenCustomerChat } from '../hooks/useOpenCustomerChat'
import { useInboxSocket, type InboxEvent } from '../hooks/useInboxSocket'
import { useToast } from '../context/ToastContext'
import type { Colleague, InternalMessage, MessageThread } from '../types'

export function MessagesPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const openCustomerChat = useOpenCustomerChat()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const [threads, setThreads] = useState<MessageThread[] | null>(null)
  const [colleagues, setColleagues] = useState<Colleague[]>([])
  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<InternalMessage[]>([])
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [showBroadcast, setShowBroadcast] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [draft, setDraft] = useState('')
  const [referencedCustomer, setReferencedCustomer] = useState<{ id: string; name: string } | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<{ id: string; name: string; whatsapp_number: string }[]>([])
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)

  function loadThreads() {
    api.get('/internal-messages/threads/').then((res) => setThreads(res.data))
  }

  useEffect(() => {
    loadThreads()
    api.get('/internal-messages/colleagues/').then((res) => setColleagues(res.data))
  }, [])

  useEffect(() => {
    if (!activeUserId) return
    api.get(`/internal-messages/with-user/${activeUserId}/`).then((res) => {
      setMessages(res.data)
      loadThreads() // refresh unread counts now that we've read this thread
    })
  }, [activeUserId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  useInboxSocket((event: InboxEvent) => {
    if (event.event !== 'internal_message') return
    const msg = event.message as InternalMessage
    loadThreads()
    if (msg.sender === activeUserId) {
      setMessages((prev) => [...prev, msg])
      api.get(`/internal-messages/with-user/${activeUserId}/`) // marks it read since we're actively viewing
    } else {
      const senderName = msg.sender_name || 'Someone'
      showToast(msg.content, { variant: 'message', title: senderName, durationMs: 6000, onClick: () => setActiveUserId(msg.sender) })
    }
  })

  useEffect(() => {
    if (customerQuery.trim().length < 2) {
      setCustomerResults([])
      return
    }
    const handle = setTimeout(() => {
      api.get('/customers/', { params: { q: customerQuery.trim() } }).then((res) => {
        setCustomerResults((res.data.results ?? res.data).slice(0, 6))
      })
    }, 300)
    return () => clearTimeout(handle)
  }, [customerQuery])

  async function handleSend() {
    if (!activeUserId || (!draft.trim() && !pendingFile)) return
    let res
    if (pendingFile) {
      const formData = new FormData()
      formData.append('recipient', activeUserId)
      formData.append('content', draft.trim())
      if (referencedCustomer) formData.append('referenced_customer', referencedCustomer.id)
      formData.append('file', pendingFile)
      res = await api.post('/internal-messages/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    } else {
      res = await api.post('/internal-messages/', {
        recipient: activeUserId,
        content: draft.trim(),
        referenced_customer: referencedCustomer?.id,
      })
    }
    setMessages((prev) => [...prev, res.data])
    setDraft('')
    setReferencedCustomer(null)
    setPendingFile(null)
    loadThreads()
  }

  const activeName =
    threads?.find((t) => t.user_id === activeUserId)?.user_name ||
    colleagues.find((c) => c.id === activeUserId)?.name ||
    ''

  return (
    <>
      <Header
        title="Messages"
        actions={
          isSuperAdmin && (
            <button
              onClick={() => setShowBroadcast(true)}
              className="flex items-center gap-1.5 rounded-md border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50"
            >
              <Megaphone size={14} />
              Message everyone
            </button>
          )
        }
      />
      <div className="flex min-h-0 flex-1">
        {/* Thread list */}
        <div className={`${activeUserId ? 'hidden md:block' : 'block'} w-full shrink-0 overflow-y-auto border-r border-ink-100 bg-white md:w-72`}>
          <div className="p-3">
            <button
              onClick={() => setShowNewMessage(true)}
              className="flex w-full items-center gap-1.5 rounded-md border border-ink-200 px-3 py-1.5 text-sm text-ink-600 transition-colors hover:bg-ink-50"
            >
              <UserPlus size={14} />
              New message
            </button>
          </div>
          {threads === null ? null : threads.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={MessageCircle} title="No messages yet" description={'Start a conversation with a colleague using "New message" above.'} />
            </div>
          ) : (
            threads.map((t) => (
              <button
                key={t.user_id}
                onClick={() => setActiveUserId(t.user_id)}
                className={`flex w-full items-center gap-3 border-b border-ink-100 px-4 py-3 text-left transition-colors hover:bg-ink-50 ${t.user_id === activeUserId ? 'bg-signal-100/40' : ''}`}
              >
                <Avatar name={t.user_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium text-ink-900">{t.user_name}</div>
                    {t.unread_count > 0 && (
                      <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-signal-600 px-1 text-[10px] font-medium text-white">
                        {t.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-ink-500">{t.last_message}</div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Active chat */}
        <div className={`${activeUserId ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col bg-ink-50`}>
          {!activeUserId ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState icon={MessageCircle} title="Select a colleague" description="Pick a conversation from the list, or start a new one." />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-ink-100 bg-white px-4 py-3">
                <button onClick={() => setActiveUserId(null)} className="-ml-1.5 shrink-0 rounded-md p-1 text-ink-500 hover:bg-ink-50 md:hidden">
                  ←
                </button>
                <Avatar name={activeName} size="sm" />
                <div className="text-sm font-medium text-ink-900">{activeName}</div>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                {messages.map((m) => {
                  const mine = m.sender !== activeUserId
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md rounded-lg px-3 py-2 text-sm ${mine ? 'bg-signal-600 text-white' : 'bg-white text-ink-900'}`}>
                        {m.broadcast_id && (
                          <div className={`mb-1 flex items-center gap-1 text-[10px] font-medium ${mine ? 'text-signal-100' : 'text-amber-500'}`}>
                            <Megaphone size={10} />
                            Sent to everyone
                          </div>
                        )}
                        {m.referenced_customer_name && (
                          <button
                            onClick={() => m.referenced_customer && openCustomerChat(m.referenced_customer)}
                            className={`mb-1.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs ${mine ? 'bg-signal-500' : 'bg-ink-50'}`}
                          >
                            <Link2 size={11} className="shrink-0" />
                            <span className="min-w-0 flex-1 truncate">
                              {m.referenced_customer_name} · {m.referenced_customer_number}
                            </span>
                          </button>
                        )}
                        {m.file_url && (
                          m.file_mime_type.startsWith('image/') ? (
                            <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="mb-1.5 block">
                              <img src={m.file_url} alt={m.file_name} className="max-h-48 w-full rounded-md object-cover" loading="lazy" />
                            </a>
                          ) : (
                            <a
                              href={m.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`mb-1.5 flex items-center gap-2 rounded-md px-2 py-2 ${mine ? 'bg-signal-500' : 'bg-ink-50'}`}
                            >
                              <FileText size={16} className="shrink-0" />
                              <span className="min-w-0 flex-1 truncate text-xs">{m.file_name}</span>
                              <Download size={13} className="shrink-0 opacity-70" />
                            </a>
                          )
                        )}
                        {m.content && <div className="whitespace-pre-wrap">{m.content}</div>}
                        <div className={`mt-1 text-right text-[10px] ${mine ? 'text-signal-100' : 'text-ink-400'}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-ink-100 bg-white p-3">
                {referencedCustomer && (
                  <div className="mb-2 flex items-center gap-1.5 rounded-md bg-signal-100 px-2 py-1.5 text-xs text-signal-600">
                    <Link2 size={11} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">Referencing {referencedCustomer.name}</span>
                    <button onClick={() => setReferencedCustomer(null)} aria-label="Remove reference">
                      <X size={12} />
                    </button>
                  </div>
                )}
                {pendingFile && (
                  <div className="mb-2 flex items-center gap-1.5 rounded-md bg-ink-50 px-2 py-1.5 text-xs text-ink-600">
                    <Paperclip size={11} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
                    <button onClick={() => setPendingFile(null)} aria-label="Remove file">
                      <X size={12} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setPendingFile(file)
                      e.target.value = ''
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 rounded-md p-2 text-ink-400 hover:bg-ink-50 hover:text-signal-600"
                    aria-label="Attach a file"
                    title="Attach a document or file"
                  >
                    <Paperclip size={18} />
                  </button>
                  <button
                    onClick={() => setShowCustomerPicker(true)}
                    className="shrink-0 rounded-md p-2 text-ink-400 hover:bg-ink-50 hover:text-signal-600"
                    aria-label="Reference a customer"
                    title="Reference a customer conversation"
                  >
                    <Link2 size={18} />
                  </button>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message…"
                    className="flex-1 rounded-md border border-ink-200 px-3 py-2 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!draft.trim() && !pendingFile}
                    className="shrink-0 rounded-md bg-signal-600 p-2 text-white transition-colors hover:bg-signal-500 disabled:opacity-50"
                    aria-label="Send"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New message picker */}
      {showNewMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm" onClick={() => setShowNewMessage(false)}>
          <div className="w-full max-w-sm rounded-lg border border-ink-100 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <div className="text-sm font-medium text-ink-900">New message</div>
              <button onClick={() => setShowNewMessage(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {colleagues.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setActiveUserId(c.id); setShowNewMessage(false) }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-ink-50"
                >
                  <Avatar name={c.name} size="xs" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink-900">{c.name}</div>
                    <div className="text-xs text-ink-500">{c.role}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Customer reference picker */}
      {showCustomerPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm" onClick={() => setShowCustomerPicker(false)}>
          <div className="w-full max-w-sm rounded-lg border border-ink-100 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
              <Search size={14} className="text-ink-400" />
              <input
                autoFocus
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Search a customer to reference…"
                className="flex-1 text-sm outline-none"
              />
              <button onClick={() => setShowCustomerPicker(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {customerResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setReferencedCustomer({ id: c.id, name: c.name || c.whatsapp_number })
                    setShowCustomerPicker(false)
                    setCustomerQuery('')
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-ink-50"
                >
                  <Avatar name={c.name || c.whatsapp_number} size="xs" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink-900">{c.name || 'Unnamed contact'}</div>
                    <div className="text-xs text-ink-500">{c.whatsapp_number}</div>
                  </div>
                </button>
              ))}
              {customerQuery.trim().length >= 2 && customerResults.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-ink-400">No matches.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Broadcast composer, Super Admin only */}
      {showBroadcast && (
        <BroadcastModal
          onClose={() => setShowBroadcast(false)}
          onSent={() => { setShowBroadcast(false); loadThreads() }}
        />
      )}
    </>
  )
}

function BroadcastModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const { showToast } = useToast()

  async function handleSend() {
    if (!content.trim()) return
    setSending(true)
    try {
      const res = await api.post('/internal-messages/broadcast/', { content: content.trim() })
      showToast(`Sent to ${res.data.recipient_count} people`)
      onSent()
    } catch {
      showToast('Failed to send broadcast', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg border border-ink-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-500">
              <Megaphone size={16} />
            </div>
            <div className="font-display text-sm font-semibold text-ink-900">Message everyone</div>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="px-5 py-4">
          <p className="mb-2 text-xs text-ink-500">This sends to every active staff member at once — everyone will get it individually.</p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="Write your announcement…"
            className="w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-4">
          <button onClick={onClose} className="rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-ink-50">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!content.trim() || sending}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500/90 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send to everyone'}
          </button>
        </div>
      </div>
    </div>
  )
}
