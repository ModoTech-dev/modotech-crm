import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Route } from 'lucide-react'
import { api } from '../api/client'
import { Header } from '../components/Header'
import { EmptyState } from '../components/EmptyState'
import { SkeletonRows } from '../components/Skeleton'
import { useDepartments } from '../hooks/useDepartments'
import { useToast } from '../context/ToastContext'
import { parseFieldErrors } from '../utils/errors'
import type { RoutingRule } from '../types'

export function SettingsPage() {
  const departments = useDepartments()
  const [rules, setRules] = useState<RoutingRule[] | null>(null)
  const [keyword, setKeyword] = useState('')
  const [department, setDepartment] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const { showToast } = useToast()

  useEffect(() => {
    if (!department && departments.length > 0) setDepartment(departments[0].code)
  }, [departments, department])

  function load() {
    api.get('/automation/routing-rules/').then((res) => setRules(res.data.results ?? res.data))
  }
  useEffect(load, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    if (!keyword.trim()) return
    try {
      await api.post('/automation/routing-rules/', { keyword: keyword.trim(), department })
      showToast(`Rule added: "${keyword.trim()}" → ${department}`)
      setKeyword('')
      load()
    } catch (err: any) {
      const errors = parseFieldErrors(err.response?.data)
      setFieldErrors(errors)
      showToast(Object.values(errors).join(' ') || 'Failed to add rule.', 'error')
    }
  }

  async function toggleRule(rule: RoutingRule) {
    await api.patch(`/automation/routing-rules/${rule.id}/`, { is_active: !rule.is_active })
    load()
  }

  async function deleteRule(rule: RoutingRule) {
    await api.delete(`/automation/routing-rules/${rule.id}/`)
    showToast(`Rule "${rule.keyword}" removed`)
    load()
  }

  return (
    <>
      <Header title="Settings" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-2 font-display text-sm font-semibold text-ink-900">Routing rules</div>
        <p className="mb-4 text-xs text-ink-500">
          When a new conversation's first message contains one of these keywords, it's routed to the
          matching department. These override the built-in defaults; higher priority runs first.
        </p>

        <form onSubmit={handleAdd} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-ink-100 bg-white p-4">
          <label className="flex flex-col gap-1 text-xs text-ink-500">
            Keyword
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. router"
              className={`w-48 rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 ${fieldErrors.keyword ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-ink-200 focus:border-signal-500 focus:ring-signal-500/20'}`}
            />
            {fieldErrors.keyword && <span className="text-red-500">{fieldErrors.keyword}</span>}
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-500">
            Department
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="rounded-md border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-signal-500 focus:ring-2 focus:ring-signal-500/20"
            >
              {departments.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          </label>
          <button type="submit" className="flex items-center gap-1.5 rounded-md bg-signal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-signal-500">
            <Plus size={14} />
            Add rule
          </button>
          {fieldErrors._general && <span className="text-xs text-red-500">{fieldErrors._general}</span>}
        </form>

        {rules && rules.length === 0 ? (
          <EmptyState icon={Route} title="No custom rules yet" description="Built-in defaults handle routing until you add rules here." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-ink-100 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-2.5">Keyword</th>
                  <th className="px-4 py-2.5">Department</th>
                  <th className="px-4 py-2.5">Active</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {!rules ? (
                  <SkeletonRows rows={3} cols={4} />
                ) : (
                  rules.map((r) => (
                    <tr key={r.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                      <td className="px-4 py-2.5 font-medium text-ink-900">"{r.keyword}"</td>
                      <td className="px-4 py-2.5 text-ink-600">{r.department}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => toggleRule(r)} className="text-xs text-signal-600 hover:underline">
                          {r.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => deleteRule(r)} className="text-xs text-ink-400 hover:text-red-500">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
