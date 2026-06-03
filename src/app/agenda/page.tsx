'use client'
import { useEffect, useState, useRef } from 'react'
import { CalendarDays, Plus, Trash2, CheckCircle2, Circle, ChevronLeft, ChevronRight, Pencil, X, Check } from 'lucide-react'
import { useAdmin } from '@/components/ui/AdminProvider'
import { useRouter } from 'next/navigation'

const BRUN = '#7B2820'
const OR = '#C8941A'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateFr(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  // 0=lundi, 6=dimanche
  const d = new Date(year, month, 1).getDay()
  return (d + 6) % 7
}

export default function AgendaPage() {
  const { isAdmin } = useAdmin()
  const router = useRouter()

  const today = todayStr()
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [selectedDay, setSelectedDay] = useState(today)
  const [notes, setNotes] = useState<any[]>([])
  const [allNotes, setAllNotes] = useState<any[]>([])

  // Formulaire nouvelle note
  const [showForm, setShowForm] = useState(false)
  const [newTitre, setNewTitre] = useState('')
  const [newContenu, setNewContenu] = useState('')
  const [newDate, setNewDate] = useState(today)
  const [saving, setSaving] = useState(false)

  // Edition inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitre, setEditTitre] = useState('')
  const [editContenu, setEditContenu] = useState('')

  useEffect(() => {
    if (!isAdmin) { router.push('/'); return }
    loadAll()
  }, [isAdmin])

  useEffect(() => {
    loadDay(selectedDay)
  }, [selectedDay])

  async function loadAll() {
    const data = await fetch('/api/agenda').then(r => r.json())
    setAllNotes(Array.isArray(data) ? data : [])
  }

  async function loadDay(date: string) {
    const data = await fetch(`/api/agenda?date=${date}`).then(r => r.json())
    setNotes(Array.isArray(data) ? data : [])
  }

  async function createNote(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitre.trim()) return
    setSaving(true)
    await fetch('/api/agenda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre: newTitre.trim(), contenu: newContenu.trim(), date_note: newDate }),
    })
    setNewTitre('')
    setNewContenu('')
    setNewDate(selectedDay)
    setShowForm(false)
    setSaving(false)
    await loadAll()
    if (newDate === selectedDay) loadDay(selectedDay)
    else { setSelectedDay(newDate); const [y, m] = newDate.split('-'); setViewYear(Number(y)); setViewMonth(Number(m) - 1) }
  }

  async function toggleFait(note: any) {
    await fetch(`/api/agenda/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fait: !note.fait }),
    })
    loadDay(selectedDay)
    loadAll()
  }

  async function deleteNote(id: string) {
    await fetch(`/api/agenda/${id}`, { method: 'DELETE' })
    loadDay(selectedDay)
    loadAll()
  }

  async function saveEdit(note: any) {
    await fetch(`/api/agenda/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre: editTitre, contenu: editContenu }),
    })
    setEditingId(null)
    loadDay(selectedDay)
    loadAll()
  }

  // Calendrier
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth)

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function hasnotes(day: number) {
    const d = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return allNotes.filter(n => n.date_note === d)
  }

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  if (!isAdmin) return null

  return (
    <div className="space-y-6 pb-10 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: BRUN }}>
            <CalendarDays size={24} style={{ color: OR }} />
            Agenda personnel
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Notes et rappels — visible uniquement par vous</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setNewDate(selectedDay) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Nouvelle note
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Calendrier */}
        <div className="card-section p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft size={18} className="text-gray-500" />
            </button>
            <span className="font-semibold text-gray-800 capitalize">{monthName}</span>
            <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight size={18} className="text-gray-500" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {JOURS.map(j => (
              <div key={j} className="text-center text-xs font-semibold text-gray-400 py-1">{j}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDay
              const dayNotes = hasnotes(day)
              const hasAny = dayNotes.length > 0
              const allDone = hasAny && dayNotes.every(n => n.fait)
              const hasPending = hasAny && dayNotes.some(n => !n.fait)

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(dateStr)}
                  className="relative flex flex-col items-center justify-center h-10 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: isSelected ? BRUN : isToday ? '#fdf5f3' : undefined,
                    color: isSelected ? 'white' : isToday ? BRUN : '#374151',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = '#f9fafb' }}
                  onMouseLeave={e => { if (!isSelected && !isToday) (e.currentTarget as HTMLElement).style.backgroundColor = ''; if (!isSelected && isToday) (e.currentTarget as HTMLElement).style.backgroundColor = '#fdf5f3' }}
                >
                  {day}
                  {hasAny && (
                    <span
                      className="absolute bottom-1 w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: isSelected ? 'white' : allDone ? '#22c55e' : OR }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* Légende */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: OR }} /> À faire</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Fait</span>
          </div>
        </div>

        {/* Notes du jour sélectionné */}
        <div className="card-section">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800 text-sm capitalize">{formatDateFr(selectedDay)}</p>
              {selectedDay === today && <p className="text-xs" style={{ color: OR }}>Aujourd'hui</p>}
            </div>
            <button
              onClick={() => { setShowForm(true); setNewDate(selectedDay) }}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-700"
              title="Ajouter une note pour ce jour"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="divide-y divide-gray-50">
            {notes.length === 0 && (
              <div className="px-4 py-10 text-center text-gray-400 text-sm">
                <CalendarDays size={32} className="mx-auto mb-2 opacity-30" />
                Aucune note pour ce jour
              </div>
            )}

            {notes.map(note => (
              <div key={note.id} className={`px-4 py-3 transition-colors ${note.fait ? 'bg-gray-50/50' : ''}`}>
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <input
                      className="input text-sm py-1.5"
                      value={editTitre}
                      onChange={e => setEditTitre(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit(note)}
                      autoFocus
                    />
                    <textarea
                      className="input text-sm py-1.5"
                      rows={2}
                      value={editContenu}
                      onChange={e => setEditContenu(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingId(null)} className="btn-secondary text-xs py-1">Annuler</button>
                      <button onClick={() => saveEdit(note)} className="btn-primary text-xs py-1 flex items-center gap-1"><Check size={12} /> Sauvegarder</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleFait(note)} className="mt-0.5 flex-shrink-0 transition-colors">
                      {note.fait
                        ? <CheckCircle2 size={20} className="text-green-500" />
                        : <Circle size={20} className="text-gray-300 hover:text-gray-500" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${note.fait ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {note.titre}
                      </p>
                      {note.contenu && (
                        <p className={`text-xs mt-0.5 whitespace-pre-wrap ${note.fait ? 'text-gray-300' : 'text-gray-500'}`}>
                          {note.contenu}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditingId(note.id); setEditTitre(note.titre); setEditContenu(note.contenu) }}
                        className="p-1 text-gray-300 hover:text-gray-600 rounded transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Formulaire nouvelle note (modal-like) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">Nouvelle note</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={createNote} className="p-5 space-y-4">
              <div>
                <label className="label">Date *</label>
                <input
                  type="date"
                  className="input"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Titre *</label>
                <input
                  className="input"
                  value={newTitre}
                  onChange={e => setNewTitre(e.target.value)}
                  placeholder="Ex : Appeler Jean-Pierre, Envoyer CMR…"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Détails <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <textarea
                  className="input"
                  rows={3}
                  value={newContenu}
                  onChange={e => setNewContenu(e.target.value)}
                  placeholder="Informations complémentaires…"
                />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Enregistrement…' : 'Créer la note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
