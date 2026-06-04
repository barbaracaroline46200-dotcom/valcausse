import { useState, useCallback } from 'react'

export type SortDir = 'asc' | 'desc'

export function useSortable<T>(defaultKey: keyof T | '', defaultDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState<keyof T | ''>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  const toggle = useCallback((key: keyof T) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  function sort(arr: T[]): T[] {
    if (!sortKey) return arr
    return [...arr].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv, 'fr')
        : (av as any) < (bv as any) ? -1 : (av as any) > (bv as any) ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  return { sortKey, sortDir, toggle, sort }
}
