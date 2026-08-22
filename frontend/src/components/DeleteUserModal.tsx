import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import type { User } from '../types'

export function DeleteUserModal({
  user,
  onClose,
  onConfirm,
}: {
  user: User
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setDeleting(true)
    setError('')
    try {
      await onConfirm()
    } catch (err: any) {
      setError(err?.response?.data?.[0] || err?.response?.data?.detail || 'Failed to delete user.')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-ink-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-500">
              <AlertTriangle size={16} />
            </div>
            <div className="font-display text-sm font-semibold text-ink-900">Delete this user?</div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm">
          <p className="text-ink-700">
            You're about to permanently delete{' '}
            <span className="font-medium text-ink-900">{user.full_name || user.email}</span> ({user.email}).
            This can't be undone — if you just want to revoke their access, <span className="font-medium">Disable</span> instead
            keeps the account and lets you restore it later.
          </p>
          <div className="rounded-md bg-ink-50 p-3">
            <div className="mb-1 font-medium text-ink-700">What happens to their data</div>
            <ul className="list-disc space-y-1 pl-4 text-ink-500">
              <li>Conversations they were assigned to stay intact, just unassigned</li>
              <li>Messages they sent stay in conversation history</li>
              <li>Internal notes they wrote are kept, attributed to "Deleted user"</li>
              <li>The deletion itself is permanently recorded in the audit log</li>
            </ul>
          </div>
          {error && <div className="rounded-md bg-red-100 px-3 py-2 text-red-500">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-4">
          <button onClick={onClose} className="rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-ink-50">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  )
}
