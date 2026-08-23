import { useEffect, useState, type FormEvent } from 'react'
import { Building2, ShieldAlert, Plus } from 'lucide-react'
import { api } from '../api/client'
import { Header } from '../components/Header'
import { StatusPill } from '../components/StatusPill'
import { EmptyState } from '../components/EmptyState'
import { SkeletonRows } from '../components/Skeleton'
import { useToast } from '../context/ToastContext'
import { parseFieldErrors } from '../utils/errors'
import type { DepartmentRecord } from '../types'

export function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentRecord[] | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [forbidden, setForbidden] = useState(false)
  const { showToast } = useToast()

  function load() {
    api
      .get('/automation/departments/')
      .then((res) => setDepartments(res.data.results ?? res.data))
      .catch((err) => {
        if (err.response?.status === 403) setForbidden(true)
      })
  }
  useEffect(load, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    if (!name.trim() || !code.trim()) return
    try {
      await api.post('/automation/departments/', { name: name.trim(), code: code.trim().toUpperCase() })
      showToast(`"${name.trim()}" department added`)
      setName('')
      setCode('')
      load()
    } catch (err: any) {
      const errors = parseFieldErrors(err.response?.data)
      setFieldErrors(errors)
      showToast(Object.values(errors).join(' ') || 'Failed to add department.', 'error')
    }
  }

  async function toggleActive(dept: DepartmentRecord) {
    await api.patch(`/automation/departments/${dept.id}/`, { is_active: !dept.is_active })
    showToast(dept.is_active ? `${dept.name} deactivated` : `${dept.name} activated`)
    load()
  }

  return (
    <>
      <Header title="Departments" />
      <div className="flex-1 overflow-y-auto p-6">
        <p className="mb-4 text-xs text-ink-500">
          Departments drive conversation assignment, agent grouping, and routing rules across the CRM.
          Deactivating a department hides it from new dropdowns without deleting existing history.
        </p>

        {forbidden ? (
          <EmptyState icon={ShieldAlert} title="Restricted" description="Managing departments is available to admins only." />
        ) : (
          <>
            <form onSubmit={handleAdd} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-ink-100 bg-white p-4">
              <label className="flex flex-col gap-1 text-xs text-ink-500">
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Installation"
                  className={`w-48 rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 ${fieldErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-ink-200 focus:border-signal-500 focus:ring-signal-500/20'}`}
                />
                {fieldErrors.name && <span className="text-red-500">{fieldErrors.name}</span>}
              </label>
              <label className="flex flex-col gap-1 text-xs text-ink-500">
                Code
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. INSTALLATION"
                  className={`w-40 rounded-md border px-2 py-1.5 text-sm uppercase outline-none focus:ring-2 ${fieldErrors.code ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-ink-200 focus:border-signal-500 focus:ring-signal-500/20'}`}
                />
                {fieldErrors.code && <span className="text-red-500">{fieldErrors.code}</span>}
              </label>
              <button type="submit" className="flex items-center gap-1.5 rounded-md bg-signal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-signal-500">
                <Plus size={14} />
                Add department
              </button>
              {fieldErrors._general && <span className="text-xs text-red-500">{fieldErrors._general}</span>}
            </form>

            {departments && departments.length === 0 ? (
              <EmptyState icon={Building2} title="No departments yet" description="Add your first department above to start routing conversations." />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-ink-100 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                    <tr>
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Code</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {!departments ? (
                      <SkeletonRows rows={4} cols={4} />
                    ) : (
                      departments.map((d) => (
                        <tr key={d.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                          <td className="px-4 py-2.5 font-medium text-ink-900">{d.name}</td>
                          <td className="px-4 py-2.5 text-ink-600">{d.code}</td>
                          <td className="px-4 py-2.5">
                            <StatusPill value={d.is_active ? 'ACTIVE' : 'SUSPENDED'} />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button onClick={() => toggleActive(d)} className="text-xs text-ink-500 hover:text-signal-600">
                              {d.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
