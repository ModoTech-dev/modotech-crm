import { useEffect, useRef, useState } from 'react'
import { Search, X, MessageSquareText, User, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Avatar } from './Avatar'
import { useOpenCustomerChat } from '../hooks/useOpenCustomerChat'
import type { Customer } from '../types'

interface MessageMatch {
  message_id: string
  conversation_id: string
  customer_name: string
  customer_whatsapp_number: string
  snippet: string
  timestamp: string
}

export function GlobalSearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [messageMatches, setMessageMatches] = useState<MessageMatch[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const openCustomerChat = useOpenCustomerChat()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setCustomers([])
      setMessageMatches([])
      return
    }
    setLoading(true)
    const handle = setTimeout(() => {
      api
        .get('/search/', { params: { q: query.trim() } })
        .then((res) => {
          setCustomers(res.data.customers)
          setMessageMatches(res.data.message_matches)
        })
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [query])

  const hasResults = customers.length > 0 || messageMatches.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/60 p-4 pt-24 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg border border-ink-100 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
          <Search size={16} className="shrink-0 text-ink-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts, or words in any chat…"
            className="flex-1 text-sm outline-none placeholder:text-ink-400"
          />
          <button onClick={onClose} className="shrink-0 text-ink-400 hover:text-ink-700" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading && <div className="px-4 py-6 text-center text-xs text-ink-400">Searching…</div>}

          {!loading && query.trim().length >= 2 && !hasResults && (
            <div className="px-4 py-6 text-center text-xs text-ink-400">No matches for "{query}".</div>
          )}

          {!loading && customers.length > 0 && (
            <div className="border-b border-ink-100 py-1">
              <div className="px-4 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">Contacts</div>
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onClose()
                    openCustomerChat(c.id)
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left hover:bg-ink-50"
                >
                  <Avatar name={c.name || c.whatsapp_number} size="xs" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink-900">{c.name || 'Unnamed contact'}</div>
                    <div className="flex items-center gap-1 truncate text-xs text-ink-500">
                      {c.whatsapp_number}
                      {c.whatsapp_number_masked && <Lock size={10} className="shrink-0" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && messageMatches.length > 0 && (
            <div className="py-1">
              <div className="px-4 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
                Messages
              </div>
              {messageMatches.map((m) => (
                <button
                  key={m.message_id}
                  onClick={() => {
                    onClose()
                    navigate(`/inbox?conversation=${m.conversation_id}`)
                  }}
                  className="flex w-full items-start gap-2.5 px-4 py-2 text-left hover:bg-ink-50"
                >
                  <MessageSquareText size={14} className="mt-0.5 shrink-0 text-ink-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm font-medium text-ink-900">
                      {m.customer_name || 'Unnamed contact'}
                    </div>
                    <div className="truncate text-xs text-ink-500">{m.snippet}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && query.trim().length < 2 && (
            <div className="px-4 py-6 text-center text-xs text-ink-400">
              <User size={20} className="mx-auto mb-2 text-ink-300" />
              Type at least 2 characters to search contacts and message content.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
