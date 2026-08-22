import { useState, type FormEvent } from 'react'
import { Receipt, X } from 'lucide-react'

export function ReceiptAttributionModal({
  customerName,
  onClose,
  onConfirm,
}: {
  customerName: string
  onClose: () => void
  onConfirm: (receipt: { payment_receipt_number: string; payment_amount: string }) => Promise<void>
}) {
  const [receiptNumber, setReceiptNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!receiptNumber.trim()) {
      setError('Enter the payment receipt / M-Pesa code before continuing.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onConfirm({ payment_receipt_number: receiptNumber.trim(), payment_amount: amount })
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-ink-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-signal-100 text-signal-600">
              <Receipt size={16} />
            </div>
            <div className="font-display text-sm font-semibold text-ink-900">Attach payment receipt</div>
          </div>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-xs text-ink-500">
            Marking <span className="font-medium text-ink-700">{customerName}</span> as a successful sale — attach
            the payment reference so this can be checked during commission reconciliation.
          </p>
          <label className="flex flex-col gap-1 text-xs text-ink-500">
            Receipt / M-Pesa code
            <input
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="e.g. QGH7X8YZ12"
              autoFocus
              className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-500">
            Amount (optional)
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              step="0.01"
              placeholder="e.g. 2500"
              className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
            />
          </label>
          {error && <div className="rounded-md bg-red-100 px-3 py-2 text-xs text-red-500">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-ink-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-md bg-signal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-signal-500 disabled:opacity-50">
            {saving ? 'Saving…' : 'Confirm sale'}
          </button>
        </div>
      </form>
    </div>
  )
}
