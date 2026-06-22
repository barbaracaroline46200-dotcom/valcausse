'use client'
import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'

interface Props {
  note: string
  size?: number
}

export default function AlerteNote({ note, size = 15 }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <span className="relative inline-flex items-center" style={{ verticalAlign: 'middle' }}>
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="text-amber-500 hover:text-amber-600 transition-colors focus:outline-none"
        aria-label="Note d'alerte"
      >
        <TriangleAlert size={size} fill="currentColor" fillOpacity={0.15} />
      </button>
      {visible && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl px-3 py-2 shadow-lg whitespace-pre-wrap pointer-events-none">
          <span className="font-semibold block mb-0.5">⚠ Note d'alerte</span>
          {note}
        </span>
      )}
    </span>
  )
}
