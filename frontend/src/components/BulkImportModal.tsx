import { useRef, useState } from 'react'
import { X, UploadCloud, CheckCircle2, AlertTriangle } from 'lucide-react'
import { api } from '../api/client'

interface ImportResult {
  created: number
  total_rows: number
  skipped: { row: number; reason: string }[]
}

export function BulkImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await api.post('/customers/bulk-import/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(res.data)
      onImported()
    } catch (err: any) {
      setError(err?.response?.data?.file?.[0] || 'Import failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border border-ink-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div className="font-display text-sm font-semibold text-ink-900">Import contacts</div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!result ? (
            <>
              <p className="mb-3 text-xs text-ink-500">
                Upload a .csv or .xlsx file. We'll recognize common column names automatically — Name, Phone
                Number / WhatsApp Number, Email, Location, Account Number. A phone number column is the only
                required one.
              </p>
              <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
              <button
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-md border-2 border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-500 transition-colors hover:border-signal-400 hover:bg-signal-50"
              >
                <UploadCloud size={24} className="text-ink-400" />
                {file ? file.name : 'Click to choose a file'}
              </button>
              {error && <div className="mt-3 rounded-md bg-red-100 px-3 py-2 text-xs text-red-500">{error}</div>}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md bg-signal-100 px-3 py-2 text-sm text-signal-600">
                <CheckCircle2 size={16} />
                Imported {result.created} of {result.total_rows} rows.
              </div>
              {result.skipped.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-500">
                    <AlertTriangle size={12} />
                    {result.skipped.length} row{result.skipped.length !== 1 ? 's' : ''} skipped
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-md border border-ink-100">
                    {result.skipped.map((s, i) => (
                      <div key={i} className="border-b border-ink-100 px-3 py-1.5 text-xs text-ink-500 last:border-0">
                        Row {s.row}: {s.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-4">
          <button onClick={onClose} className="rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-ink-50">
            {result ? 'Done' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="rounded-md bg-signal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-signal-500 disabled:opacity-50"
            >
              {uploading ? 'Importing…' : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
