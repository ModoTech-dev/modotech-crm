import { useEffect, useRef } from 'react'
import { tokenStore } from '../api/client'

export interface InboxEvent {
  type: 'conversation.event'
  event: 'new_message' | 'conversation_created' | 'conversation_updated' | 'conversation_assigned' | 'notification' | 'internal_message'
  conversation_id?: string
  [key: string]: unknown
}

/**
 * Opens one WebSocket per logged-in agent (see apps/conversations/consumers.py).
 * Reconnects with backoff on drop — a shared inbox can't afford to silently
 * stop receiving new-message pushes.
 */
export function useInboxSocket(onEvent: (event: InboxEvent) => void) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    let socket: WebSocket | null = null
    let retryDelay = 1000
    let closedByClient = false
    let waitingForTokenTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      const token = tokenStore.getAccess()
      if (!token) {
        // No token yet doesn't mean "never" — this hook can genuinely
        // mount before login finishes (deliberately, so notifications
        // are ready the instant auth completes, not just on whichever
        // page happens to load next). Keep checking instead of giving
        // up permanently after one failed attempt.
        waitingForTokenTimer = setTimeout(connect, 1000)
        return
      }
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      // Browsers can't attach a custom Authorization header to a raw
      // WebSocket handshake, so the access token travels as a query
      // param instead — read server-side by JWTAuthMiddleware.
      socket = new WebSocket(`${protocol}://${window.location.host}/ws/inbox/?token=${encodeURIComponent(token)}`)

      socket.onmessage = (msg) => {
        try {
          onEventRef.current(JSON.parse(msg.data))
        } catch {
          /* ignore malformed frame */
        }
      }
      socket.onclose = () => {
        if (closedByClient) return
        setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 2, 15000)
      }
      socket.onopen = () => {
        retryDelay = 1000
      }
    }

    connect()
    return () => {
      closedByClient = true
      if (waitingForTokenTimer) clearTimeout(waitingForTokenTimer)
      socket?.close()
    }
  }, [])
}
