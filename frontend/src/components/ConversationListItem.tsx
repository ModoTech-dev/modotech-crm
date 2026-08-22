import clsx from 'clsx'
import { StatusPill } from './StatusPill'
import { Avatar } from './Avatar'
import type { ConversationListItem as ConversationListItemType } from '../types'

export function ConversationListItem({
  conversation,
  active,
  onClick,
}: {
  conversation: ConversationListItemType
  active: boolean
  onClick: () => void
}) {
  const displayName = conversation.customer_name || conversation.customer_whatsapp_number

  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex w-full items-start gap-3 border-b border-ink-100 px-4 py-3 text-left transition-colors',
        active ? 'bg-signal-100/60' : 'hover:bg-ink-50'
      )}
    >
      <Avatar name={displayName} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-sm font-medium text-ink-900">{displayName}</div>
          {conversation.unread_count > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-signal-600 px-1 text-[11px] font-medium text-white">
              {conversation.unread_count}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-ink-500">{conversation.last_message_preview || 'No messages yet'}</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusPill value={conversation.status} />
          {conversation.priority !== 'NORMAL' && <StatusPill value={conversation.priority} />}
          {conversation.assigned_agent_name && (
            <span className="text-[11px] text-ink-400">{conversation.assigned_agent_name}</span>
          )}
        </div>
      </div>
    </button>
  )
}
