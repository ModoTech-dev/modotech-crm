import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { PhoneCheckResult } from '../types'

/**
 * Debounced phone-number format check. Fires ~600ms after the person
 * stops typing (not on every keystroke) so the popup doesn't flicker
 * mid-entry. See apps/customers/services/phone_validation.py on the
 * backend for what this can and can't actually confirm — format only,
 * not real WhatsApp registration.
 */
export function usePhoneCheck(rawNumber: string) {
  const [result, setResult] = useState<PhoneCheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    setResult(null)
    if (!rawNumber || rawNumber.trim().length < 6) return

    setChecking(true)
    debounceRef.current = setTimeout(() => {
      api
        .get<PhoneCheckResult>('/customers/check-number/', { params: { number: rawNumber.trim() } })
        .then((res) => setResult(res.data))
        .catch(() => setResult({ valid: false, reason: "Couldn't check this number right now." }))
        .finally(() => setChecking(false))
    }, 600)

    return () => clearTimeout(debounceRef.current)
  }, [rawNumber])

  return { result, checking }
}
