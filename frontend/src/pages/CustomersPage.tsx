import { useEffect, useState } from 'react'
import { Search, Users, UserPlus, Lock, Pencil, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Header } from '../components/Header'
import { StatusPill } from '../components/StatusPill'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { SkeletonRows } from '../components/Skeleton'
import { NewContactModal } from '../components/NewContactModal'
import { CustomerEditModal } from '../components/CustomerEditModal'
import { ReceiptAttributionModal } from '../components/ReceiptAttributionModal'
import { BulkImportModal } from '../components/BulkImportModal'
import { useOpenCustomerChat } from '../hooks/useOpenCustomerChat'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { Customer } from '../types'

const OUTCOME_STYLES: Record<string, string> = {
  PENDING: 'text-amber-500 bg-amber-100',
  SUCCESSFUL: 'text-signal-600 bg-signal-100',
  REJECTED: 'text-red-500 bg-red-100',
}

export function CustomersPage({ statusFilter, title = 'Customers' }: { statusFilter?: string; title?: string }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewContact, setShowNewContact] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [receiptPromptFor, setReceiptPromptFor] = useState<Customer | null>(null)
  const navigate = useNavigate()
  const openCustomerChat = useOpenCustomerChat()
  const { user } = useAuth()
  const { showToast } = useToast()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isAdminTier = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
  const isSales = user?.role === 'SALES'
  const isLeadsView = statusFilter === 'LEAD'

  function load() {
    setLoading(true)
    const params: Record<string, string> = {}
    if (query) params.q = query
    if (statusFilter) params.status = statusFilter
    api
      .get('/customers/', { params })
      .then((res) => setCustomers(res.data.results ?? res.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const handle = setTimeout(load, 250)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statusFilter])

  async function applyLeadOutcome(customerId: string, outcome: string, extra?: Record<string, string>) {
    try {
      const res = await api.patch(`/customers/${customerId}/`, { lead_outcome: outcome, ...extra })
      setCustomers((prev) => prev.map((c) => (c.id === customerId ? res.data : c)))
    } catch {
      showToast('Failed to update lead outcome', 'error')
      throw new Error('failed')
    }
  }

  function handleOutcomeChange(customer: Customer, outcome: string) {
    // Sales agents marking a lead SUCCESSFUL get prompted for a payment
    // receipt first — needed for commission reconciliation. Every other
    // role/outcome combination just saves directly; receipts are a
    // sales-specific workflow, not a general requirement.
    if (isSales && outcome === 'SUCCESSFUL') {
      setReceiptPromptFor(customer)
      return
    }
    applyLeadOutcome(customer.id, outcome)
  }

  return (
    <>
      <Header
        title={title}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, phone, account number…"
                className="w-72 rounded-md border border-ink-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
              />
            </div>
            {isAdminTier && (
              <button
                onClick={() => setShowBulkImport(true)}
                className="flex items-center gap-1.5 rounded-md border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50"
              >
                <Upload size={14} />
                Import
              </button>
            )}
            <button
              onClick={() => setShowNewContact(true)}
              className="flex items-center gap-1.5 rounded-md bg-signal-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-signal-500"
            >
              <UserPlus size={14} />
              Add contact
            </button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {!loading && customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={query ? 'No matching customers' : `No ${title.toLowerCase()} yet`}
            description={query ? 'Try a different name, phone number, or account number.' : 'Customers appear here as soon as they message your WhatsApp number, or you can add one directly.'}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-ink-100 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">WhatsApp</th>
                  <th className="px-4 py-2.5">Status</th>
                  {isLeadsView && <th className="px-4 py-2.5">Outcome</th>}
                  <th className="px-4 py-2.5">Account #</th>
                  <th className="px-4 py-2.5">Open conversations</th>
                  <th className="px-4 py-2.5">Last contact</th>
                  {isSuperAdmin && <th className="px-4 py-2.5"></th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={isLeadsView ? 7 : 6} />
                ) : (
                  customers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => openCustomerChat(c.id)}
                      className="cursor-pointer border-b border-ink-100 last:border-0 hover:bg-ink-50"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={c.name || c.whatsapp_number} size="xs" />
                          <span className="font-medium text-ink-900">{c.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-ink-600">
                        <span className="inline-flex items-center gap-1">
                          {c.whatsapp_number}
                          {c.whatsapp_number_masked && (
                            <Lock size={11} className="text-ink-400" aria-label="Full number visible to Super Admin only" />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2.5"><StatusPill value={c.status} /></td>
                      {isLeadsView && (
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={c.lead_outcome || 'PENDING'}
                            onChange={(e) => handleOutcomeChange(c, e.target.value)}
                            className={`rounded-md border-0 px-2 py-1 text-xs font-medium outline-none ${OUTCOME_STYLES[c.lead_outcome || 'PENDING']}`}
                          >
                            <option value="PENDING">Pending</option>
                            <option value="SUCCESSFUL">Successful</option>
                            <option value="REJECTED">Rejected</option>
                          </select>
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-ink-600">{c.account_number || '—'}</td>
                      <td className="px-4 py-2.5 text-ink-600">{c.open_conversation_count}</td>
                      <td className="px-4 py-2.5 text-ink-600">
                        {c.last_contact_at ? new Date(c.last_contact_at).toLocaleDateString() : '—'}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setEditingCustomer(c)}
                            className="text-ink-400 hover:text-signal-600"
                            aria-label="Edit customer"
                            title="Edit customer details"
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNewContact && (
        <NewContactModal
          onClose={() => setShowNewContact(false)}
          onStarted={() => {
            setShowNewContact(false)
            load()
            navigate('/inbox')
          }}
        />
      )}

      {showBulkImport && (
        <BulkImportModal onClose={() => setShowBulkImport(false)} onImported={load} />
      )}

      {editingCustomer && (
        <CustomerEditModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSaved={(updated) => {
            setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
            setEditingCustomer(null)
          }}
        />
      )}

      {receiptPromptFor && (
        <ReceiptAttributionModal
          customerName={receiptPromptFor.name || receiptPromptFor.whatsapp_number}
          onClose={() => setReceiptPromptFor(null)}
          onConfirm={async (receipt) => {
            await applyLeadOutcome(receiptPromptFor.id, 'SUCCESSFUL', receipt)
            setReceiptPromptFor(null)
          }}
        />
      )}
    </>
  )
}
