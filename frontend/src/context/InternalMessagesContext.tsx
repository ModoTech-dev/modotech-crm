import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useInboxSocket, type InboxEvent } from '../hooks/useInboxSocket'
import { useToast } from './ToastContext'
import { useAuth } from './AuthContext'
import type { InternalMessage } from '../types'

interface InternalMessagesContextValue {
  unreadCount: number
  refreshUnreadCount: () => void
  setActiveThreadUserId: (id: string | null) => void
  onIncomingMessage: (callback: (msg: InternalMessage) => void) => () => void
}

const InternalMessagesContext = createContext<InternalMessagesContextValue | null>(null)

/**
 * A single, app-wide place that listens for internal messages —
 * deliberately NOT scoped to the Messages page itself, since a
 * notification that only fires while you happen to already be looking
 * at Messages isn't really a notification. This is what makes the
 * Sidebar badge and the toast popup work no matter which page you're
 * actually on.
 *
 * MessagesPage still needs live updates for whichever thread is
 * currently open, but gets them through onIncomingMessage here rather
 * than opening its own second WebSocket connection for the same user.
 */
export function InternalMessagesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const activeThreadRef = useRef<string | null>(null)
  const listenersRef = useRef<Set<(msg: InternalMessage) => void>>(new Set())

  function setActiveThreadUserId(id: string | null) {
    activeThreadRef.current = id
  }

  function refreshUnreadCount() {
    if (!user) return
    api.get('/internal-messages/unread-count/').then((res) => setUnreadCount(res.data.count))
  }

  useEffect(() => {
    if (user) refreshUnreadCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useInboxSocket((event: InboxEvent) => {
    if (event.event !== 'internal_message' || !user) return
    const msg = event.message as InternalMessage
    if (msg.recipient !== user.id) return // a message we sent ourselves, echoed back — not new for us

    listenersRef.current.forEach((cb) => cb(msg))

    if (msg.sender === activeThreadRef.current) {
      // Already actively viewing this exact thread — MessagesPage
      // appends it directly and marks it read as part of that, so a
      // toast here would just be redundant noise.
      return
    }

    refreshUnreadCount()
    showToast(msg.content || (msg.file_name ? `Sent a file: ${msg.file_name}` : 'Sent a message'), {
      variant: 'message',
      title: msg.sender_name || 'New message',
      durationMs: 6000,
      onClick: () => navigate(`/messages?with=${msg.sender}`),
    })
  })

  function onIncomingMessage(callback: (msg: InternalMessage) => void) {
    listenersRef.current.add(callback)
    return () => {
      listenersRef.current.delete(callback)
    }
  }

  return (
    <InternalMessagesContext.Provider value={{ unreadCount, refreshUnreadCount, setActiveThreadUserId, onIncomingMessage }}>
      {children}
    </InternalMessagesContext.Provider>
  )
}

export function useInternalMessages() {
  const ctx = useContext(InternalMessagesContext)
  if (!ctx) throw new Error('useInternalMessages must be used within InternalMessagesProvider')
  return ctx
}
