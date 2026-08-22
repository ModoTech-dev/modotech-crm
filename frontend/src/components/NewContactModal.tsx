import { useEffect, useState, type FormEvent } from 'react'
import { X, CheckCircle2, XCircle, Loader2, Send } from 'lucide-react'
import { api } from '../api/client'
import { usePhoneCheck } from '../hooks/usePhoneCheck'
import { extractTemplateVariables } from '../utils/template'
import { parseFieldErrors } from '../utils/errors'
import { useToast } from '../context/ToastContext'
import type { MessageTemplate } from '../types'

export function NewContactModal({
  onClose,
  onStarted,
}: {
  onClose: () => void
  onStarted: (conversationId: string) => void
}) {
  const { showToast } = useToast()
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [variables, setVariables] = useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const { result: phoneCheck, checking: checkingPhone } = usePhoneCheck(whatsappNumber)

  useEffect(() => {
    api.get('/whatsapp/templates/').then((res) =>
      setTemplates((res.data.results ?? res.data).filter((t: MessageTemplate) => t.status === 'APPROVED'))
    )
  }, [])

  const selectedTemplate = templates.find((t) => t.id === templateId)
  const templateVars = selectedTemplate ? extractTemplateVariables(selectedTemplate.body) : []

  // Auto-fill a variable literally named "customer_name" from the Name
  // field, since that's the overwhelmingly common case — one less thing
  // for the agent to type twice.
  useEffect(() => {
    if (templateVars.includes('customer_name') && name && !variables.customer_name) {
      setVariables((v) => ({ ...v, customer_name: name }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, templateId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    if (phoneCheck && !phoneCheck.valid) {
      setFieldErrors({ whatsapp_number: phoneCheck.reason || 'Enter a valid phone number.' })
      return
    }
    setSubmitting(true)
    try {
      const res = await api.post('/conversations/start/', {
        whatsapp_number: phoneCheck?.formatted || whatsappNumber.trim(),
        name: name.trim(),
        template: templateId,
        template_variables: variables,
      })
      showToast(`Conversation started with ${name.trim() || whatsappNumber}`)
      onStarted(res.data.id)
    } catch (err: any) {
      if (err.response?.status === 502) {
        // A clean, specific delivery failure from Meta itself — this is
        // the authoritative "couldn't reach this number" signal.
        setFieldErrors({ _general: err.response.data.detail })
        showToast(err.response.data.detail, 'error')
      } else {
        const errors = parseFieldErrors(err.response?.data)
        setFieldErrors(errors)
        showToast(Object.values(errors).join(' ') || 'Failed to start conversation.', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg border border-ink-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div className="font-display text-sm font-semibold text-ink-900">New contact</div>
          <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="flex flex-col gap-1 text-xs text-ink-500">
            WhatsApp number
            <input
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="e.g. 0712345678"
              required
              autoFocus
              className={`rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 ${
                fieldErrors.whatsapp_number
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-ink-200 focus:border-signal-500 focus:ring-signal-500/20'
              }`}
            />
            {/* The live format-check popup */}
            {checkingPhone && (
              <span className="flex items-center gap-1 text-ink-400">
                <Loader2 size={11} className="animate-spin" />
                Checking format…
              </span>
            )}
            {!checkingPhone && phoneCheck?.valid && (
              <span className="flex flex-col gap-0.5 rounded-md bg-signal-100 px-2 py-1.5 text-signal-600">
                <span className="flex items-center gap-1 font-medium">
                  <CheckCircle2 size={12} />
                  Valid {phoneCheck.country} number — {phoneCheck.formatted}
                </span>
                <span className="text-[11px] font-normal text-signal-600/80">{phoneCheck.note}</span>
              </span>
            )}
            {!checkingPhone && phoneCheck && !phoneCheck.valid && (
              <span className="flex items-center gap-1 rounded-md bg-red-100 px-2 py-1.5 text-red-500">
                <XCircle size={12} />
                {phoneCheck.reason}
              </span>
            )}
            {fieldErrors.whatsapp_number && !phoneCheck && (
              <span className="text-red-500">{fieldErrors.whatsapp_number}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-xs text-ink-500">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer's name"
              className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-ink-500">
            Opening template
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              required
              className={`rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 ${
                fieldErrors.template
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-ink-200 focus:border-signal-500 focus:ring-signal-500/20'
              }`}
            >
              <option value="">Select…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {fieldErrors.template && <span className="text-red-500">{fieldErrors.template}</span>}
            {templates.length === 0 && (
              <span className="text-ink-400">
                No APPROVED templates yet. WhatsApp requires a template to message someone who hasn't
                written in first — create one under Templates and get it approved in Meta Business Manager.
              </span>
            )}
          </label>

          {selectedTemplate && (
            <div className="rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-600">{selectedTemplate.body}</div>
          )}

          {templateVars.map((varName) => (
            <label key={varName} className="flex flex-col gap-1 text-xs text-ink-500">
              {varName.replace(/_/g, ' ')}
              <input
                value={variables[varName] || ''}
                onChange={(e) => setVariables((v) => ({ ...v, [varName]: e.target.value }))}
                required
                className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
              />
            </label>
          ))}

          {fieldErrors._general && (
            <div className="rounded-md bg-red-100 px-3 py-2 text-xs text-red-500">{fieldErrors._general}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-ink-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || templates.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-signal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-signal-500 disabled:opacity-50"
          >
            <Send size={14} />
            {submitting ? 'Starting…' : 'Start conversation'}
          </button>
        </div>
      </form>
    </div>
  )
}
