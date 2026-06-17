'use client'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS_NOMS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const PRODUIT_COLORS: Record<string, string> = {
  'blé': '#c8941a', 'ble': '#c8941a',
  'orge': '#7B5EA7', 'orge de printemps': '#7B5EA7',
  'maïs': '#e07b39', 'mais': '#e07b39',
  'tournesol': '#e0c23a',
  'colza': '#4a9e6b',
  'soja': '#2a7a9e', 'tourteau': '#2a7a9e',
  'triticale': '#a05050',
  'pois': '#6baa6b',
}

function getCouleur(produitNom: string, type: string) {
  if (type === 'realisee') return { bg: '#dcfce7', border: '#16a34a', text: '#15803d' }
  const key = Object.keys(PRODUIT_COLORS).find(k => produitNom?.toLowerCase().includes(k))
  const color = key ? PRODUIT_COLORS[key] : '#7B2820'
  return { bg: color + '20', border: color, text: color }
}

// Calcule le lundi de la semaine ISO n de l'année y
function getLundiSemaine(semStr: string, year: number): Date | null {
  const match = semStr.match(/\d+/)
  if (!match) return null
  const n = parseInt(match[0])
  const jan4 = new Date(year, 0, 4)
  const jourSem = jan4.getDay() || 7
  const lundi1 = new Date(jan4)
  lundi1.setDate(jan4.getDate() - jourSem + 1)
  const lundi = new Date(lundi1)
  lundi.setDate(lundi1.getDate() + (n - 1) * 7)
  return lundi
}

function getLundiDeLaSemaine(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isBetween(d: Date, start: Date, end: Date) {
  return d >= start && d <= end
}

function formatDateCourte(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

interface LivraisonEvent {
  id: string
  contrat_achat_id: string
  type: 'realisee' | 'planifiee'
  date_prevue?: string | null
  date_reelle?: string | null
  semaine_prevue?: string | null
  mois_prevu?: string | null
  quantite_prevue?: number
  quantite_reelle?: number
  produit: string
  numero_contrat: string
  agriculteur: string
  transporteur: string
  destination_silo?: boolean
}

export default function CalendrierLivraisons() {
  const now = new Date()
  const [startDate, setStartDate] = useState<Date>(() => getLundiDeLaSemaine(now))
  const [livraisons, setLivraisons] = useState<LivraisonEvent[]>([])
  const [loading, setLoading] = useState(false)

  const endDate = addDays(startDate, 13)

  useEffect(() => {
    setLoading(true)
    const moisSet = new Set<string>()
    for (let i = 0; i < 14; i++) {
      const d = addDays(startDate, i)
      moisSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
    }
    Promise.all(
      [...moisSet].map(m => fetch(`/api/livraisons?mois=${m}`).then(r => r.json()))
    ).then(results => {
      const all = results.flat()
      const seen = new Set<string>()
      const events: LivraisonEvent[] = all
        .filter((l: any) => { if (seen.has(l.id)) return false; seen.add(l.id); return true })
        .map((l: any) => ({
          id: l.id,
          contrat_achat_id: l.contrat_achat_id,
          type: l.type,
          date_prevue: l.date_prevue,
          date_reelle: l.date_reelle,
          semaine_prevue: l.semaine_prevue,
          mois_prevu: l.mois_prevu,
          quantite_prevue: l.quantite_prevue,
          quantite_reelle: l.quantite_reelle,
          produit: l.contrat_achat?.produit?.nom ?? '—',
          numero_contrat: l.contrat_achat?.numero_contrat ?? '—',
          agriculteur: (() => {
            const cv = (l.contrat_achat?.contrats_vente ?? []).find((cv: any) => cv.id === l.contrat_vente_id)
            if (cv?.destination_silo) return cv.silo_nom ?? 'Silo'
            return [cv?.agriculteur?.civilite, cv?.agriculteur?.nom].filter(Boolean).join(' ') || '—'
          })(),
          transporteur: l.transporteur?.nom ?? l.contrat_achat?.transporteur?.nom ?? '—',
          destination_silo: l.destination_silo,
        }))
      setLivraisons(events)
      setLoading(false)
    })
  }, [startDate])

  function prev() { setStartDate(d => addDays(d, -14)) }
  function next() { setStartDate(d => addDays(d, 14)) }

  const semaines: Date[][] = [
    Array.from({ length: 7 }, (_, i) => addDays(startDate, i)),
    Array.from({ length: 7 }, (_, i) => addDays(startDate, 7 + i)),
  ]

  const aujourd = new Date()
  const debutMoisActuel = new Date(aujourd.getFullYear(), aujourd.getMonth(), 1)

  const livsEnRetard = livraisons.filter(l => {
    if (l.type === 'realisee') return false
    if (!l.mois_prevu) return false
    if (l.date_prevue || l.semaine_prevue) return false
    return new Date(l.mois_prevu) < debutMoisActuel
  })

  const livsJour = livraisons.filter(l => l.date_prevue || l.date_reelle)
  const livsSemaine = livraisons.filter(l => !l.date_prevue && !l.date_reelle && l.semaine_prevue)
  const livsNonFix = livraisons.filter(l =>
    !l.date_prevue && !l.date_reelle && !l.semaine_prevue &&
    l.mois_prevu && new Date(l.mois_prevu) >= debutMoisActuel
  )

  function getLivsForDay(day: Date): LivraisonEvent[] {
    return livsJour.filter(l => {
      const dateStr = l.type === 'realisee' ? l.date_reelle : l.date_prevue
      if (!dateStr) return false
      return isSameDay(new Date(dateStr), day)
    })
  }

  function getLivsForSemaine(semaine: Date[]): LivraisonEvent[] {
    const lundi = semaine[0]
    const dimanche = semaine[6]
    const year = lundi.getFullYear()
    return livsSemaine.filter(l => {
      const lundiSem = getLundiSemaine(l.semaine_prevue!, year)
        ?? getLundiSemaine(l.semaine_prevue!, year + 1)
        ?? getLundiSemaine(l.semaine_prevue!, year - 1)
      if (!lundiSem) return false
      const dimancheSem = new Date(lundiSem); dimancheSem.setDate(lundiSem.getDate() + 6)
      return isBetween(lundi, lundiSem, dimancheSem) || isBetween(dimanche, lundiSem, dimancheSem)
    })
  }

  const today = new Date()
  const isCurrentWindow = isSameDay(startDate, getLundiDeLaSemaine(now))

  const labelPeriode = startDate.getMonth() === endDate.getMonth()
    ? `${formatDateCourte(startDate)} — ${endDate.getDate()} ${MOIS_NOMS[endDate.getMonth()]} ${endDate.getFullYear()}`
    : `${formatDateCourte(startDate)} — ${formatDateCourte(endDate)} ${endDate.getFullYear()}`

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between"
           style={{ backgroundColor: '#fdf5f3' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-lg"
               style={{ backgroundColor: '#7B2820' }}>📅</div>
          <div>
            <h2 className="font-bold" style={{ color: '#3a1e1a' }}>Calendrier des livraisons</h2>
            <p className="text-xs" style={{ color: '#7B2820', opacity: 0.7 }}>Vue 2 semaines — planifiées et réalisées</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-1.5 rounded-lg hover:bg-white border border-gray-200 transition-colors">
            <ChevronLeft size={16} className="text-gray-600" />
          </button>
          <span className="font-bold text-sm w-52 text-center capitalize" style={{ color: '#7B2820' }}>
            {labelPeriode}
          </span>
          <button onClick={next} className="p-1.5 rounded-lg hover:bg-white border border-gray-200 transition-colors">
            <ChevronRight size={16} className="text-gray-600" />
          </button>
          {!isCurrentWindow && (
            <button
              onClick={() => setStartDate(getLundiDeLaSemaine(now))}
              className="ml-1 px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-white transition-colors"
            >
              Aujourd'hui
            </button>
          )}
        </div>
      </div>

      {/* Légende */}
      <div className="px-5 py-2 flex items-center gap-4 border-b border-gray-100 bg-gray-50/50 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#C8941A', opacity: 0.7 }} />
          Planifiée (date fixe)
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-sm inline-block border-2 border-dashed" style={{ borderColor: '#C8941A' }} />
          Planifiée (semaine)
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#16a34a', opacity: 0.7 }} />
          Réalisée
        </div>
        {livsNonFix.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-3 rounded-sm inline-block bg-gray-300" />
            Non fixée ({livsNonFix.length})
          </div>
        )}
        {livsEnRetard.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-red-500 font-semibold">
            <span className="w-3 h-3 rounded-sm inline-block bg-red-200 border border-red-400" />
            En retard ({livsEnRetard.length})
          </div>
        )}
      </div>

      {loading && (
        <div className="py-10 text-center text-gray-400 text-sm">Chargement...</div>
      )}

      {!loading && (
        <div className="p-3">
          {/* En-têtes jours */}
          <div className="grid grid-cols-7 mb-1">
            {JOURS.map(j => (
              <div key={j} className="text-center text-xs font-semibold text-gray-400 py-1">{j}</div>
            ))}
          </div>

          {/* 2 semaines */}
          {semaines.map((semaine, si) => {
            const livsS = getLivsForSemaine(semaine)
            return (
              <div key={si}>
                {/* Bande semaine */}
                {livsS.length > 0 && (
                  <div className="grid grid-cols-7 mb-0.5">
                    <div className="col-span-7 flex flex-wrap gap-1 px-1 py-0.5 rounded-md border-2 border-dashed mb-1"
                         style={{ borderColor: '#C8941A', backgroundColor: '#fff8f0' }}>
                      {livsS.map(l => {
                        const c = getCouleur(l.produit, l.type)
                        return (
                          <a key={l.id} href={`/contrats/${l.contrat_achat_id}`}
                             className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium hover:opacity-80 transition-opacity"
                             style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                             title={`${l.produit} · ${l.numero_contrat} · ${l.agriculteur} · ${l.transporteur}`}>
                            📦 {l.produit.split(' ')[0]} · {l.numero_contrat} · {l.agriculteur !== '—' ? l.agriculteur : ''} · {l.semaine_prevue}
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Cellules jours */}
                <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                  {semaine.map((day, di) => {
                    const isToday = isSameDay(day, today)
                    const livsD = getLivsForDay(day)
                    return (
                      <div key={di}
                           className={`min-h-[72px] rounded-lg p-1 ${isToday ? 'ring-2' : ''}`}
                           style={{
                             backgroundColor: isToday ? '#fdf5f3' : 'white',
                             border: isToday ? '2px solid #7B2820' : '1px solid #f3f4f6',
                           }}>
                        <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-white w-5 h-5 rounded-full flex items-center justify-center text-center' : 'text-gray-500'}`}
                             style={isToday ? { backgroundColor: '#7B2820' } : {}}>
                          {day.getDate()}
                        </div>
                        <div className="space-y-0.5">
                          {livsD.map(l => {
                            const c = getCouleur(l.produit, l.type)
                            const tonnes = l.type === 'realisee' ? l.quantite_reelle : l.quantite_prevue
                            return (
                              <a key={l.id} href={`/contrats/${l.contrat_achat_id}`}
                                 className="block text-xs rounded px-1 py-0.5 leading-tight hover:opacity-80 transition-opacity"
                                 style={{ backgroundColor: c.bg, color: c.text, borderLeft: `3px solid ${c.border}` }}
                                 title={`${l.produit} · ${l.numero_contrat} · ${l.agriculteur} · ${l.transporteur} · ${tonnes}t`}>
                                <div className="font-semibold truncate">{l.produit.split(' ')[0]}</div>
                                <div className="truncate opacity-80">{l.numero_contrat}</div>
                                <div className="truncate opacity-70">{l.agriculteur}</div>
                                <div className="truncate opacity-60">{l.transporteur}</div>
                              </a>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Livraisons en retard */}
          {livsEnRetard.length > 0 && (
            <div className="mt-3 border-2 border-red-300 rounded-lg p-3 bg-red-50">
              <p className="text-xs font-semibold text-red-600 mb-2">⚠️ Livraisons en retard — prévues sur des mois passés</p>
              <div className="flex flex-wrap gap-2">
                {livsEnRetard.map(l => {
                  const c = getCouleur(l.produit, l.type)
                  const tonnes = l.quantite_prevue
                  const moisLabel = l.mois_prevu ? new Date(l.mois_prevu).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '—'
                  return (
                    <a key={l.id} href={`/contrats/${l.contrat_achat_id}`}
                       className="text-xs rounded-lg px-3 py-1.5 font-medium hover:opacity-80 transition-opacity"
                       style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                      <span className="font-bold">{l.produit}</span>
                      <span className="mx-1 opacity-60">·</span>{l.numero_contrat}
                      <span className="mx-1 opacity-60">·</span>{l.agriculteur}
                      <span className="mx-1 opacity-60">·</span>{l.transporteur}
                      <span className="mx-1 opacity-60">·</span><span className="font-bold">{tonnes} t</span>
                      <span className="ml-2 text-red-500 font-semibold">({moisLabel})</span>
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          {/* Livraisons non fixées */}
          {livsNonFix.length > 0 && (
            <NonFixees livraisons={livsNonFix} getCouleur={getCouleur} />
          )}

          {livraisons.length === 0 && (
            <div className="py-10 text-center text-gray-400 text-sm">Aucune livraison sur cette période</div>
          )}
        </div>
      )}
    </div>
  )
}

function NonFixees({ livraisons, getCouleur }: { livraisons: any[]; getCouleur: (p: string, t: string) => any }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="mt-3 border border-dashed border-gray-300 rounded-lg overflow-hidden">
      <button
        onClick={() => setOuvert(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
          📌 Livraisons du mois — date non encore fixée
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-bold">{livraisons.length}</span>
        </span>
        {ouvert ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
      </button>
      {ouvert && (
        <div className="px-3 pb-3 flex flex-wrap gap-2">
          {livraisons.map(l => {
            const c = getCouleur(l.produit, l.type)
            const tonnes = l.type === 'realisee' ? l.quantite_reelle : l.quantite_prevue
            return (
              <a key={l.id} href={`/contrats/${l.contrat_achat_id}`}
                 className="text-xs rounded-lg px-3 py-1.5 font-medium hover:opacity-80 transition-opacity"
                 style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                <span className="font-bold">{l.produit}</span>
                <span className="mx-1 opacity-60">·</span>{l.numero_contrat}
                <span className="mx-1 opacity-60">·</span>{l.agriculteur}
                <span className="mx-1 opacity-60">·</span>{l.transporteur}
                <span className="mx-1 opacity-60">·</span><span className="font-bold">{tonnes} t</span>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
