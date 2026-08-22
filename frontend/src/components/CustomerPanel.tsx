import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Customer, ISPAccount } from '../types'
import { StatusPill } from './StatusPill'
import { Avatar } from './Avatar'
import { Users, Wifi, Lock } from 'lucide-react'

export function CustomerPanel({ customer }: { customer: Customer | null }) {
  const [isp, setIsp] = useState<ISPAccount | null>(null)
  const [ispError, setIspError] = useState(false)

  useEffect(() => {
    setIsp(null)
    setIspError(false)
    if (!customer?.isp_customer_id) return
    api
      .get(`/customers/${customer.id}/isp/`)
      .then((res) => setIsp(res.data))
      .catch(() => setIspError(true))
  }, [customer?.id, customer?.isp_customer_id])

  if (!customer) {
    return (
      <div className="flex w-72 shrink-0 flex-col items-center justify-center gap-2 border-l border-ink-100 bg-white p-4 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-50 text-ink-400">
          <Users size={18} strokeWidth={1.75} />
        </div>
        <div className="text-sm text-ink-400">Select a conversation to see customer details</div>
      </div>
    )
  }

  return (
    <div className="w-72 shrink-0 overflow-y-auto border-l border-ink-100 bg-white p-4">
      <div className="mb-3 flex items-center gap-3">
        <Avatar name={customer.name || customer.whatsapp_number} size="md" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-ink-900">{customer.name || 'Unnamed customer'}</div>
          <div className="flex items-center gap-1 text-xs text-ink-500">
            {customer.whatsapp_number}
            {customer.whatsapp_number_masked && (
              <Lock size={11} className="text-ink-400" aria-label="Full number visible to Super Admin only" />
            )}
          </div>
        </div>
      </div>
      <StatusPill value={customer.status} />

      <div className="mt-4 space-y-2 text-sm">
        <Row label="Email" value={customer.email} />
        <Row label="Phone" value={customer.phone} />
        <Row label="Location" value={customer.location} />
        <Row label="ISP account" value={customer.account_number} />
      </div>

      {customer.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1">
          {customer.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full px-2 py-0.5 text-xs"
              style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {customer.notes && (
        <div className="mt-4">
          <div className="mb-1 text-xs font-medium text-ink-500">Notes</div>
          <div className="text-sm text-ink-700">{customer.notes}</div>
        </div>
      )}

      {customer.isp_customer_id && (
        <div className="mt-5 border-t border-ink-100 pt-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-500">
            <Wifi size={13} />
            ISP account
          </div>
          {ispError ? (
            <div className="text-xs text-ink-400">Couldn't load ISP account details.</div>
          ) : !isp ? (
            <div className="text-xs text-ink-400">Loading…</div>
          ) : (
            <div className="space-y-2 text-sm">
              <Row label="Package" value={isp.package} />
              <Row label="Speed" value={`${isp.speed_mbps} Mbps`} />
              <Row label="Monthly price" value={`KSh ${isp.monthly_price.toLocaleString()}`} />
              <Row label="Status" value={isp.status} />
              <Row label="Balance" value={`KSh ${isp.balance.toLocaleString()}`} />
              <Row label="Last payment" value={isp.last_payment_date ?? '—'} />
              <Row label="Next expiry" value={isp.next_expiry_date ?? '—'} />
              <Row label="Installed" value={isp.installation_date ?? '—'} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-2">
      <span className="text-ink-400">{label}</span>
      <span className="truncate text-ink-900">{value}</span>
    </div>
  )
}
