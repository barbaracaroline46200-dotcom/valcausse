'use client'
import { useState } from 'react'
import { Filter, X, RotateCcw, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterConfig {
  key: string
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}

interface FilterBarProps {
  filters: FilterConfig[]
  onReset: () => void
}

export default function FilterBar({ filters, onReset }: FilterBarProps) {
  const [open, setOpen] = useState(false)
  const activeFilters = filters.filter(f => f.value !== '')
  const hasActive = activeFilters.length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
            hasActive
              ? 'border-green-300 bg-green-50 text-green-700'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
          )}
        >
          <Filter size={16} />
          Filtres
          {hasActive && (
            <span className="bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {activeFilters.length}
            </span>
          )}
          <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
        </button>

        {hasActive && (
          <button onClick={onReset} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
            <RotateCcw size={14} />
            Réinitialiser
          </button>
        )}
      </div>

      {open && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          {filters.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
              <select
                value={f.value}
                onChange={e => f.onChange(e.target.value)}
                className="input py-1.5 text-sm"
              >
                <option value="">Tous</option>
                {f.options.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {hasActive && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map(f => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-xs font-medium text-green-700"
            >
              <span className="text-green-500">{f.label}:</span>
              {f.options.find(o => o.value === f.value)?.label ?? f.value}
              <button
                onClick={() => f.onChange('')}
                className="hover:text-green-900 ml-0.5"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
