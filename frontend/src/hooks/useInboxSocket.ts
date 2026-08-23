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

    function connect() {
      const token = tokenStore.getAccess()
      if (!token) return
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      socket = new WebSocket(`${protocol}://${window.location.host}/ws/inbox/`)

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
      socket?.close()
    }
  }, [])
}
