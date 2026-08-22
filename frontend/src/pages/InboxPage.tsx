import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MessageSquareText, Inbox as InboxIcon, UserPlus, Lock } from 'lucide-react'
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const loadConversations = useCallback(() => {
    api.get('/conversations/').then((res) => setConversations(res.data.results ?? res.data))
  }, [])

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

  return (
    <>
      <Header
        title="Inbox"
        actions={
          <button
            onClick={() => setShowNewContact(true)}
            className="flex items-center gap-1.5 rounded-md bg-signal-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-signal-500"
          >
            <UserPlus size={14} />
            New contact
          </button>
        }
      />
      <div className="flex min-h-0 flex-1">
        <div className="w-80 shrink-0 overflow-y-auto border-r border-ink-100 bg-white">
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
                title="No conversations yet"
                description="Incoming WhatsApp messages will appear here as soon as a customer writes in."
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

        <div className="flex min-w-0 flex-1 flex-col bg-ink-50">
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
                <Avatar name={detail.customer.name || detail.customer.whatsapp_number} size="sm" />
                <div>
                  <div className="text-sm font-medium text-ink-900">
                    {detail.customer.name || detail.customer.whatsapp_number}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-ink-500">
                    {detail.customer.whatsapp_number}
                    {detail.customer.whatsapp_number_masked && (
                      <Lock size={11} className="text-ink-400" aria-label="Full number visible to Super Admin only" />
                    )}
                    <span>· {detail.department}</span>
                  </div>
                </div>
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

        <CustomerPanel customer={detail?.customer ?? null} />
      </div>

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
