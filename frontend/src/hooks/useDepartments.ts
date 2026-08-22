import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { DepartmentRecord } from '../types'

export function useDepartments(activeOnly = true) {
  const [departments, setDepartments] = useState<DepartmentRecord[]>([])

  useEffect(() => {
    api.get('/automation/departments/').then((res) => {
      const all: DepartmentRecord[] = res.data.results ?? res.data
      setDepartments(activeOnly ? all.filter((d) => d.is_active) : all)
    })
  }, [activeOnly])

  return departments
}
