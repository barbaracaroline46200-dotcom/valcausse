'use client'
import { TriangleAlert } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  note: string
  size?: number
}

export default function AlerteNote({ note, size = 15 }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setMounted(true) }, [])

  function show() {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.top + window.scrollY, left: r.left + r.width / 2 + window.scrollX })
  }

  function hide() { setPos(null) }

  const tooltip = (mounted && pos) ? createPortal(
    <span
      style={{ position: 'absolute', top: pos.top - 8, left: pos.left, transform: 'translate(-50%, -100%)', zIndex: 9999 }}
      className="w-72 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl px-3 py-2 shadow-lg whitespace-pre-wrap pointer-events-none block"
    >
      <span className="font-semibold block mb-0.5">⚠ Note d'alerte</span>
      {note}
    </span>,
    document.body
  ) : null

  return (
    <span className="inline-flex items-center" style={{ verticalAlign: 'middle' }}>
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="text-amber-500 hover:text-amber-600 transition-colors focus:outline-none"
        aria-label="Note d'alerte"
      >
        <TriangleAlert size={size} fill="currentColor" fillOpacity={0.15} />
      </button>
      {tooltip}
    </span>
  )
}
