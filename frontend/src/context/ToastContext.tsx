import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle, MessageSquareText, X } from 'lucide-react'

interface Toast {
  id: number
  title?: string
  message: string
  variant: 'success' | 'error' | 'message'
  onClick?: () => void
}

interface ToastOptions {
  variant?: 'success' | 'error' | 'message'
  title?: string
  onClick?: () => void
  durationMs?: number
}

interface ToastContextValue {
  showToast: (message: string, variantOrOptions?: 'success' | 'error' | ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  message: MessageSquareText,
}
const ICON_COLORS = {
  success: 'text-signal-500',
  error: 'text-red-500',
  message: 'text-signal-500',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string, variantOrOptions?: 'success' | 'error' | ToastOptions) => {
    const options: ToastOptions =
      typeof variantOrOptions === 'string' ? { variant: variantOrOptions } : variantOrOptions || {}
    const { variant = 'success', title, onClick, durationMs = 4000 } = options

    const id = nextId.current++
    setToasts((prev) => [...prev, { id, title, message, variant, onClick }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, durationMs)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICONS[t.variant]
          return (
            <div
              key={t.id}
              onClick={() => {
                t.onClick?.()
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }}
              className={`animate-toast-in pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg ${
                t.variant === 'error' ? 'border-red-100' : 'border-signal-100'
              } bg-white text-ink-900 ${t.onClick ? 'cursor-pointer hover:shadow-xl' : ''}`}
            >
              <Icon size={16} className={`mt-0.5 shrink-0 ${ICON_COLORS[t.variant]}`} />
              <div className="min-w-0 flex-1">
                {t.title && <div className="font-medium">{t.title}</div>}
                <div className="truncate text-ink-600">{t.message}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setToasts((prev) => prev.filter((x) => x.id !== t.id))
                }}
                className="ml-1 shrink-0 text-ink-400 hover:text-ink-700"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
