import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageSquareText, Inbox as InboxIcon, UserPlus, Lock, ChevronLeft, Info, X, Filter, Check } from 'lucide-react'
import { api } from '../api/client'
import { Header } from '../components/Header'
import { ConversationListItem } from '../components/ConversationListItem'
import { MessageBubble } from '../components/MessageBubble'
import { MessageComposer } from '../components/MessageComposer'
import { CustomerPanel } from '../components/CustomerPanel'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { Skeleton } from '../components/Skeleton'
import { NewContactModal } from '../components/NewContactModal'
import { DateSeparator } from '../components/DateSeparator'
import { ChatBackground } from '../components/ChatBackground'
import { isSameDay } from '../utils/dates'
import { useInboxSocket, type InboxEvent } from '../hooks/useInboxSocket'
import { useToast } from '../context/ToastContext'
import type { ConversationDetail, ConversationListItem as ConversationListItemType, Message } from '../types'

export function InboxPage() {
  const [conversations, setConversations] = useState<ConversationListItemType[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [showNewContact, setShowNewContact] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showCustomerPanelMobile, setShowCustomerPanelMobile] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const loadConversations = useCallback(() => {
    // Mirrors whatever filter params are currently in the URL — this is
    // what makes the Dashboard's clickable tiles work: each one just
    // navigates here with the right combination already set.
    const params: Record<string, string> = {}
    for (const key of ['status', 'unread', 'unassigned', 'mine']) {
      const value = searchParams.get(key)
      if (value) params[key] = value
    }
    api.get('/conversations/', { params }).then((res) => setConversations(res.data.results ?? res.data))
  }, [searchParams])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Lets search results and the Customers tab deep-link straight into a
  // specific conversation (?conversation=<id>) rather than needing the
  // agent to find it in the list themselves.
  useEffect(() => {
    const target = searchParams.get('conversation')
    if (target) {
      setActiveId(target)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('conversation')
        return next
      }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    if (!activeId) return
    api.get<ConversationDetail>(`/conversations/${activeId}/`).then((res) => setDetail(res.data))
    api.get(`/conversations/${activeId}/messages/`).then((res) => setMessages(res.data))

    // Opening a conversation marks it read — clear the unread badge both
    // locally (instant) and on the backend (so it stays cleared on
    // refresh, and other agents see it too, since unread is shared).
    api.post(`/conversations/${activeId}/mark-read/`).catch(() => {})
    setConversations((prev) =>
      prev ? prev.map((c) => (c.id === activeId ? { ...c, unread_count: 0 } : c)) : prev
    )
  }, [activeId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  useInboxSocket((event: InboxEvent) => {
    if (event.event === 'new_message' || event.event === 'conversation_updated' || event.event === 'conversation_created') {
      loadConversations()

      if (event.conversation_id === activeId && event.event === 'new_message') {
        setMessages((prev) => [...prev, event.message as Message])
        // Already looking at it — immediately re-mark read rather than
        // letting the badge flicker on then off from the next list reload.
        api.post(`/conversations/${activeId}/mark-read/`).catch(() => {})
      } else if (event.event === 'new_message') {
        const msg = event.message as Message
        // Skip our own outbound sends — only pop a toast for messages
        // actually coming in from a customer.
        if (msg.sender_type !== 'CUSTOMER') return

        const known = conversations?.find((c) => c.id === event.conversation_id)
        const displayName = known?.customer_name || known?.customer_whatsapp_number || 'New message'
        showToast(msg.content || 'Sent a message', {
          variant: 'message',
          title: displayName,
          durationMs: 6000,
          onClick: () => setActiveId(event.conversation_id as string),
        })
      }
    }
  })

  async function handleSend(content: string) {
    if (!activeId) return
    const res = await api.post(`/conversations/${activeId}/messages/`, { message_type: 'TEXT', content })
    setMessages((prev) => [...prev, res.data])
  }

  async function handleSendLocation(location: { latitude: number; longitude: number; name: string; address: string }) {
    if (!activeId) return
    const res = await api.post(`/conversations/${activeId}/messages/`, {
      message_type: 'LOCATION',
      latitude: location.latitude,
      longitude: location.longitude,
      location_name: location.name,
      location_address: location.address,
    })
    setMessages((prev) => [...prev, res.data])
  }

  async function handleSendFile(file: File, caption: string) {
    if (!activeId) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('content', caption)
    const res = await api.post(`/conversations/${activeId}/send-media/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    setMessages((prev) => [...prev, res.data])
  }

  const withinWindow = detail?.service_window_expires_at
    ? new Date(detail.service_window_expires_at) > new Date()
    : false

  // A human-readable label for whatever filter combination is active in
  // the URL right now — this is what makes it obvious the list has been
  // replaced by a filtered view (e.g. from a Dashboard tile), not just
  // silently changed, and gives a clear way back to the normal list.
  const activeFilterLabel = (() => {
    const parts: string[] = []
    if (searchParams.get('mine') === 'true') parts.push('Assigned to me')
    if (searchParams.get('unassigned') === 'true') parts.push('Unassigned')
    if (searchParams.get('unread') === 'true') parts.push('Unread')
    const status = searchParams.get('status')
    if (status) parts.push(`Status: ${status.charAt(0) + status.slice(1).toLowerCase()}`)
    return parts.length > 0 ? parts.join(' · ') : null
  })()

  // Toggling a boolean filter (mine/unassigned/unread) flips it on/off
  // in place, keeping any OTHER active filters untouched — e.g. you can
  // combine "Unread" with "Status: Open" at the same time.
  function toggleBooleanFilter(key: 'mine' | 'unassigned' | 'unread') {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (next.get(key) === 'true') next.delete(key)
      else next.set(key, 'true')
      return next
    })
  }

  function setStatusFilter(status: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (status) next.set('status', status)
      else next.delete('status')
      return next
    })
  }

  const activeFilterCount = ['mine', 'unassigned', 'unread'].filter((k) => searchParams.get(k) === 'true').length
    + (searchParams.get('status') ? 1 : 0)

  return (
    <>
      <Header
        title="Inbox"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu((v) => !v)}
                className="relative z-40 flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50"
              >
                <Filter size={14} />
                Filter
                {activeFilterCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-signal-600 px-1 text-[10px] font-medium text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {showFilterMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowFilterMenu(false)} />
                  <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-lg border border-ink-100 bg-white p-2 shadow-lg">
                    {([
                      ['unread', 'Unread'],
                      ['unassigned', 'Unassigned'],
                      ['mine', 'Assigned to me'],
                    ] as const).map(([key, label]) => {
                      const active = searchParams.get(key) === 'true'
                      return (
                        <button
                          key={key}
                          onClick={() => toggleBooleanFilter(key)}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-ink-50"
                        >
                          {label}
                          {active && <Check size={14} className="text-signal-600" />}
                        </button>
                      )
                    })}
                    <div className="my-1.5 border-t border-ink-100" />
                    <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">Status</div>
                    {[
                      ['OPEN', 'Open'],
                      ['PENDING', 'Pending'],
                      ['RESOLVED', 'Resolved'],
                      ['CLOSED', 'Closed'],
                    ].map(([value, label]) => {
                      const active = searchParams.get('status') === value
                      return (
                        <button
                          key={value}
                          onClick={() => setStatusFilter(active ? null : value)}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-ink-50"
                        >
                          {label}
                          {active && <Check size={14} className="text-signal-600" />}
                        </button>
                      )
                    })}
                    {activeFilterCount > 0 && (
                      <>
                        <div className="my-1.5 border-t border-ink-100" />
                        <button
                          onClick={() => {
                            setSearchParams({}, { replace: true })
                            setShowFilterMenu(false)
                          }}
                          className="w-full rounded-md px-2 py-1.5 text-left text-sm text-ink-500 hover:bg-ink-50"
                        >
                          Clear all filters
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setShowNewContact(true)}
              className="flex items-center gap-1.5 rounded-md bg-signal-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-signal-500"
            >
              <UserPlus size={14} />
              New contact
            </button>
          </div>
        }
      />
      <div className="flex min-h-0 flex-1">
        {/* Conversation list — full width on mobile when nothing's
            selected yet, hidden on mobile once a chat is open (replaced
            by the chat view below). Always visible, fixed-width, on
            desktop regardless of selection. */}
        <div
          className={`${activeId ? 'hidden md:block' : 'block'} w-full shrink-0 overflow-y-auto border-r border-ink-100 bg-white md:w-80`}
        >
          {activeFilterLabel && (
            <div className="flex items-center justify-between gap-2 border-b border-signal-100 bg-signal-100/40 px-4 py-2 text-xs">
              <span className="font-medium text-signal-600">{activeFilterLabel}</span>
              <button
                onClick={() => setSearchParams({}, { replace: true })}
                className="shrink-0 text-ink-500 underline hover:text-ink-700"
              >
                Clear
              </button>
            </div>
          )}
          {conversations === null ? (
            <div className="space-y-4 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={InboxIcon}
                title={activeFilterLabel ? 'Nothing matches this filter' : 'No conversations yet'}
                description={
                  activeFilterLabel
                    ? `No conversations currently match "${activeFilterLabel}".`
                    : 'Incoming WhatsApp messages will appear here as soon as a customer writes in.'
                }
              />
            </div>
          ) : (
            conversations.map((c) => (
              <ConversationListItem
                key={c.id}
                conversation={c}
                active={c.id === activeId}
                onClick={() => setActiveId(c.id)}
              />
            ))
          )}
        </div>

        {/* Active chat — hidden on mobile until a conversation is
            selected, then takes the full screen with a back button to
            return to the list. Always visible on desktop. */}
        <div className={`${activeId ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col bg-ink-50`}>
          {!detail ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={MessageSquareText}
                title="Select a conversation"
                description="Pick a conversation from the list to view the message history and reply."
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-ink-100 bg-white px-4 py-3">
                <button
                  onClick={() => setActiveId(null)}
                  className="-ml-1.5 shrink-0 rounded-md p-1 text-ink-500 hover:bg-ink-50 md:hidden"
                  aria-label="Back to conversations"
                >
                  <ChevronLeft size={20} />
                </button>
                <Avatar name={detail.customer.name || detail.customer.whatsapp_number} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink-900">
                    {detail.customer.name || detail.customer.whatsapp_number}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-ink-500">
                    {detail.customer.whatsapp_number}
                    {detail.customer.whatsapp_number_masked && (
                      <Lock size={11} className="text-ink-400" aria-label="Full number visible to Super Admin only" />
                    )}
                    <span className="hidden sm:inline">· {detail.department}</span>
                  </div>
                </div>
                {/* Customer info lives as a third column on desktop, but
                    needs its own entry point on mobile since there's no
                    room for a third column there. */}
                <button
                  onClick={() => setShowCustomerPanelMobile(true)}
                  className="shrink-0 rounded-md p-1.5 text-ink-500 hover:bg-ink-50 md:hidden"
                  aria-label="View customer info"
                >
                  <Info size={18} />
                </button>
              </div>
              <div className="relative flex-1 overflow-hidden">
                <ChatBackground />
                <div ref={scrollRef} className="relative h-full space-y-2 overflow-y-auto p-4">
                  {messages.map((m, i) => {
                    const current = new Date(m.timestamp)
                    const previous = i > 0 ? new Date(messages[i - 1].timestamp) : null
                    const showSeparator = !previous || !isSameDay(current, previous)
                    return (
                      <div key={m.id}>
                        {showSeparator && <DateSeparator date={current} />}
                        <MessageBubble
                          message={m}
                          onDeleted={(updated) =>
                            setMessages((prev) => prev.map((msg) => (msg.id === updated.id ? updated : msg)))
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
              <MessageComposer
                disabled={!withinWindow}
                disabledReason="Outside the 24h customer service window — only templates can be sent."
                onSend={handleSend}
                onSendLocation={handleSendLocation}
                onSendFile={handleSendFile}
              />
            </>
          )}
        </div>

        {/* Third column on desktop only — see the Info button above for
            how this same content is reached on mobile instead. */}
        <div className="hidden md:block">
          <CustomerPanel customer={detail?.customer ?? null} />
        </div>
      </div>

      {/* Mobile-only: customer info as a full-screen overlay, since
          there's no room for a permanent third column on a narrow
          screen. Reuses the exact same CustomerPanel desktop already
          has, just presented differently. */}
      {showCustomerPanelMobile && (
        <div className="fixed inset-0 z-40 bg-white md:hidden">
          <div className="flex h-12 items-center justify-between border-b border-ink-100 px-4">
            <div className="text-sm font-medium text-ink-900">Customer info</div>
            <button
              onClick={() => setShowCustomerPanelMobile(false)}
              className="rounded-md p-1 text-ink-500 hover:bg-ink-50"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <div className="h-[calc(100%-3rem)] overflow-y-auto">
            <CustomerPanel customer={detail?.customer ?? null} />
          </div>
        </div>
      )}

      {showNewContact && (
        <NewContactModal
          onClose={() => setShowNewContact(false)}
          onStarted={(conversationId) => {
            setShowNewContact(false)
            loadConversations()
            setActiveId(conversationId)
          }}
        />
      )}
    </>
  )
}
