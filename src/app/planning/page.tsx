'use client'
import { useEffect, useState, useMemo, useRef, type CSSProperties } from 'react'
import { Loader2, Grid3X3, CheckCircle2, CalendarCheck, Clock, ChevronDown, X } from 'lucide-react'

const MOIS_NOMS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const MOIS_LONGS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function moisKey(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

function parseMois(s: string): { y: number; m: number } {
  const [y, m] = s.slice(0, 7).split('-').map(Number)
  return { y, m: m - 1 }
}

function moisLabel(key: string) {
  const { y, m } = parseMois(key)
  return `${MOIS_LONGS[m]} ${y}`
}

function moisShort(key: string) {
  const { y, m } = parseMois(key)
  return `${MOIS_NOMS[m]} ${String(y).slice(2)}`
}

function rowStyle(famille: string, isSilo: boolean) {
  if (isSilo) return { backgroundColor: '#fffbeb', borderLeft: '3px solid #C8941A' }
  if (famille === 'negoce') return { backgroundColor: '#fdf5f3', borderLeft: '3px solid #7B2820' }
  return { backgroundColor: '#eff6fb', borderLeft: '3px solid #2a5570' }
}

// Colonnes fixes (gelées) : État, Céréale, N° Contrat, Fournisseur, N° Contrat V., Agriculteur, Transporteur
const FROZEN_WIDTHS = [80, 144, 128, 128, 128, 176, 128]
const FROZEN_LEFTS = FROZEN_WIDTHS.reduce<number[]>((acc, w, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + FROZEN_WIDTHS[i - 1])
  return acc
}, [])
const FROZEN_TOTAL = FROZEN_WIDTHS.reduce((s, w) => s + w, 0)
const MOIS_COL_WIDTH = 90

function frozenThStyle(i: number): CSSProperties {
  return {
    position: 'sticky',
    top: 0,
    left: FROZEN_LEFTS[i],
    zIndex: 20,
    width: FROZEN_WIDTHS[i],
    backgroundColor: '#fdf5f3',
    ...(i === FROZEN_WIDTHS.length - 1 ? { borderRight: '2px solid #e4b5ad' } : {}),
  }
}

function frozenTdStyle(i: number, bg: string, extra?: CSSProperties): CSSProperties {
  return {
    position: 'sticky',
    left: FROZEN_LEFTS[i],
    zIndex: 1,
    width: FROZEN_WIDTHS[i],
    backgroundColor: bg,
    ...(i === FROZEN_WIDTHS.length - 1 ? { borderRight: '2px solid #e4b5ad' } : {}),
    ...extra,
  }
}

// ── Dropdown multi-sélection (mois) ───────────────────────────────────────────
function MultiSelect({
  label,
  options,
  selected,
  onChange,
  renderLabel,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
  renderLabel?: (v: string) => string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggle(val: string) {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val])
  }

  const label2 = selected.length === 0
    ? label
    : selected.length === 1
      ? (renderLabel ? renderLabel(selected[0]) : selected[0])
      : `${selected.length} sélectionnés`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`input text-sm py-1.5 flex items-center gap-1 min-w-[11rem] justify-between ${selected.length > 0 ? 'border-orange-400 bg-orange-50' : ''}`}
      >
        <span className="truncate text-left flex-1" style={{ color: selected.length > 0 ? '#c2410c' : undefined }}>
          {label2}
        </span>
        {selected.length > 0
          ? <X size={13} className="flex-shrink-0 text-orange-400" onClick={e => { e.stopPropagation(); onChange([]) }} />
          : <ChevronDown size={13} className="flex-shrink-0 text-gray-400" />
        }
      </button>

      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[14rem] py-1 max-h-64 overflow-y-auto">
          {options.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">Aucune option</p>
          )}
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded border-gray-300 accent-orange-500"
              />
              <span className="leading-tight">{renderLabel ? renderLabel(opt) : opt}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                type="button"
                onClick={() => { onChange([]); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600"
              >
                Effacer la sélection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PlanningPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtFamille, setFiltFamille] = useState('')
  const [filtProduit, setFiltProduit] = useState('')
  const [filtStatut, setFiltStatut] = useState('en_cours')
  const [filtClient, setFiltClient] = useState('')
  const [filtFournisseur, setFiltFournisseur] = useState('')
  const [filtMois, setFiltMois] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const didAutoScroll = useRef(false)

  useEffect(() => {
    fetch('/api/planning')
      .then(r => r.json())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  const produits = useMemo(() => {
    const s = new Set<string>()
    rows.forEach(r => { const n = r.contrat_achat?.produit?.nom; if (n) s.add(n) })
    return [...s].sort()
  }, [rows])

  function getClientNom(row: any): string {
    const cv = row.contrat_vente ?? null
    if (!cv) return '—'
    if (cv.destination_silo) return cv.silo_nom ?? 'Silo'
    return cv.agriculteur?.nom ?? '—'
  }

  const clients = useMemo(() => {
    const s = new Set<string>()
    rows.forEach(r => { const n = getClientNom(r); if (n && n !== '—') s.add(n) })
    return [...s].sort()
  }, [rows])

  const fournisseurs = useMemo(() => {
    const s = new Set<string>()
    rows.forEach(r => { const n = r.contrat_achat?.fournisseur?.nom; if (n) s.add(n) })
    return [...s].sort()
  }, [rows])

  function formatT(n: number) {
    return n % 1 === 0 ? `${n} t` : `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} t`
  }

  function rowMoisKey(row: any): string | null {
    if (row.type === 'realisee' && row.date_reelle) return row.date_reelle.slice(0, 7)
    if (row.mois_prevu) return row.mois_prevu.slice(0, 7)
    return null
  }

  // Filtres hors mois — sert aussi de base à la liste des mois disponibles
  const filteredBase = useMemo(() => rows.filter(r => {
    if (filtFamille && r.contrat_achat?.famille !== filtFamille) return false
    if (filtProduit && r.contrat_achat?.produit?.nom !== filtProduit) return false
    if (filtStatut && r.contrat_achat?.statut !== filtStatut) return false
    if (filtClient && getClientNom(r) !== filtClient) return false
    if (filtFournisseur && r.contrat_achat?.fournisseur?.nom !== filtFournisseur) return false
    return true
  }), [rows, filtFamille, filtProduit, filtStatut, filtClient, filtFournisseur])

  const moisOptions = useMemo(() => {
    const s = new Set<string>()
    filteredBase.forEach(r => { const k = rowMoisKey(r); if (k) s.add(k) })
    return [...s].sort()
  }, [filteredBase])

  const filtered = useMemo(() => {
    if (filtMois.length === 0) return filteredBase
    return filteredBase.filter(r => {
      const k = rowMoisKey(r)
      return !!k && filtMois.includes(k)
    })
  }, [filteredBase, filtMois])

  // Mois affichés en colonnes : la sélection si elle existe, sinon la plage couverte par les livraisons filtrées
  const moisRange = useMemo(() => {
    if (filtMois.length > 0) return [...filtMois].sort()
    if (filtered.length === 0) {
      const now = new Date()
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
        return moisKey(d.getFullYear(), d.getMonth())
      })
    }
    const keys = filtered.map(rowMoisKey).filter(Boolean) as string[]
    if (keys.length === 0) return []
    const min = keys.reduce((a, b) => a < b ? a : b)
    const max = keys.reduce((a, b) => a > b ? a : b)
    const { y: yMin, m: mMin } = parseMois(min)
    const { y: yMax, m: mMax } = parseMois(max)
    const result: string[] = []
    let y = yMin, m = mMin
    while (y < yMax || (y === yMax && m <= mMax)) {
      result.push(moisKey(y, m))
      m++; if (m > 11) { m = 0; y++ }
    }
    return result
  }, [filtered, filtMois])

  // Un contrat livré en plusieurs fois a plusieurs lignes "livraisons" (une par mois,
  // parfois plusieurs par mois) — on les regroupe ici sur une seule ligne du tableau,
  // avec une marque par mois concerné, au lieu d'une ligne quasi-identique par livraison.
  const groupedRows = useMemo(() => {
    const map = new Map<string, any>()
    for (const row of filtered) {
      const ca = row.contrat_achat ?? {}
      const cv = row.contrat_vente ?? null
      const key = `${row.contrat_achat_id ?? 'noca'}|${row.contrat_vente_id ?? cv?.id ?? 'nocv'}`
      let g = map.get(key)
      if (!g) {
        g = {
          key, ca, cv,
          isSilo: !!cv?.destination_silo,
          clientNom: getClientNom(row),
          transporteurs: new Set<string>(),
          marks: new Map<string, { nbRealisee: number; qtyRealisee: number; nbPlanifiee: number; qtyPlanifiee: number }>(),
          total: 0,
          realiseeCount: 0,
          anyTransporteurContacte: false,
        }
        map.set(key, g)
      }
      g.transporteurs.add(row.transporteur?.nom ?? ca.transporteur?.nom ?? '—')
      g.total++
      if (row.type === 'realisee') g.realiseeCount++
      if (row.transporteur_contacte) g.anyTransporteurContacte = true

      const k = rowMoisKey(row)
      if (k) {
        const m = g.marks.get(k) ?? { nbRealisee: 0, qtyRealisee: 0, nbPlanifiee: 0, qtyPlanifiee: 0 }
        if (row.type === 'realisee') {
          m.nbRealisee++
          m.qtyRealisee += Number(row.quantite_reelle) || 0
        } else {
          m.nbPlanifiee++
          m.qtyPlanifiee += Number(row.quantite_prevue) || 0
        }
        g.marks.set(k, m)
      }
    }
    return Array.from(map.values())
  }, [filtered])

  // Au premier chargement, positionner le scroll horizontal sur le mois en cours
  useEffect(() => {
    if (loading || didAutoScroll.current || !scrollRef.current) return
    didAutoScroll.current = true
    const now = new Date()
    const idx = moisRange.indexOf(moisKey(now.getFullYear(), now.getMonth()))
    if (idx > 0) scrollRef.current.scrollLeft = idx * MOIS_COL_WIDTH
  }, [loading, moisRange])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-green-600" size={32} />
    </div>
  )

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#7B2820' }}>Planning des livraisons</h1>
          <p className="text-gray-500 text-sm mt-0.5">Vue matricielle — livraisons planifiées par mois</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filtStatut} onChange={e => setFiltStatut(e.target.value)} className="input text-sm py-1.5 w-36">
            <option value="">Tous statuts</option>
            <option value="en_cours">En cours</option>
            <option value="clos">Clos</option>
          </select>
          <select value={filtFamille} onChange={e => setFiltFamille(e.target.value)} className="input text-sm py-1.5 w-32">
            <option value="">Toutes familles</option>
            <option value="negoce">Négoce</option>
            <option value="appro">Appro</option>
          </select>
          <select value={filtProduit} onChange={e => setFiltProduit(e.target.value)} className="input text-sm py-1.5 w-44">
            <option value="">Tous produits</option>
            {produits.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filtFournisseur} onChange={e => setFiltFournisseur(e.target.value)} className="input text-sm py-1.5 w-44">
            <option value="">Tous fournisseurs</option>
            {fournisseurs.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={filtClient} onChange={e => setFiltClient(e.target.value)} className="input text-sm py-1.5 w-48">
            <option value="">Tous agriculteurs</option>
            {clients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <MultiSelect label="Tous les mois" options={moisOptions} selected={filtMois} onChange={setFiltMois} renderLabel={moisLabel} />
        </div>
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 size={14} className="text-green-600" />
          Réalisée
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarCheck size={14} className="text-blue-600" />
          Planifiée (transporteur contacté)
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={14} className="text-orange-500" />
          À organiser
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 size={14} className="text-amber-600" />
          Partiellement livrée
        </span>
        <span className="text-gray-300">|</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#fdf5f3', border: '2px solid #7B2820' }} />
          Négoce
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#eff6fb', border: '2px solid #2a5570' }} />
          Appro
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#fffbeb', border: '2px solid #C8941A' }} />
          Silo
        </span>
        <span className="ml-4 text-gray-400">{filtered.length} livraison{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Tableau scrollable */}
      <div className="card overflow-hidden p-0">
        <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <table className="w-full text-xs" style={{ tableLayout: 'fixed', minWidth: `${FROZEN_TOTAL + moisRange.length * MOIS_COL_WIDTH}px` }}>
            <colgroup>
              {FROZEN_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
              {moisRange.map(k => <col key={k} style={{ width: MOIS_COL_WIDTH }} />)}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="border-b-2" style={{ borderColor: '#e4b5ad', backgroundColor: '#fdf5f3' }}>
                {/* Colonnes fixes (gelées à gauche) */}
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis" style={frozenThStyle(0)}>État</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis" style={frozenThStyle(1)}>Céréale</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis" style={frozenThStyle(2)}>N° Contrat</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis" style={frozenThStyle(3)}>Fournisseur</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis" style={frozenThStyle(4)}>N° Contrat V.</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis" style={frozenThStyle(5)}>Agriculteur</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis" style={frozenThStyle(6)}>Transporteur</th>
                {/* Colonnes mois (défilantes) */}
                {moisRange.map(k => (
                  <th key={k} className="px-2 py-2.5 text-center font-semibold text-gray-600 whitespace-nowrap">
                    {moisShort(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedRows.length === 0 && (
                <tr>
                  <td colSpan={7 + moisRange.length} className="px-4 py-10 text-center text-gray-400">
                    Aucune livraison planifiée correspondant aux filtres
                  </td>
                </tr>
              )}
              {groupedRows.map((g) => {
                const rowSty = rowStyle(g.ca.famille, g.isSilo)
                const transporteurLabel = [...g.transporteurs].join(' / ')
                const etat = g.realiseeCount === g.total
                  ? 'livre'
                  : g.realiseeCount === 0
                    ? (g.anyTransporteurContacte ? 'planifie' : 'a_organiser')
                    : 'partiel'

                return (
                  <tr
                    key={g.key}
                    className="border-b border-gray-100 hover:brightness-95 transition-all"
                    style={rowSty}
                  >
                    <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis" style={frozenTdStyle(0, rowSty.backgroundColor, { borderLeft: rowSty.borderLeft })}>
                      {etat === 'livre' && (
                        <span className="flex items-center gap-1 text-green-700 font-semibold text-[11px]">
                          <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
                          Livré
                        </span>
                      )}
                      {etat === 'planifie' && (
                        <span className="flex items-center gap-1 text-blue-700 font-semibold text-[11px]">
                          <CalendarCheck size={14} className="text-blue-600 flex-shrink-0" />
                          Planifié
                        </span>
                      )}
                      {etat === 'a_organiser' && (
                        <span className="flex items-center gap-1 text-orange-600 font-semibold text-[11px]">
                          <Clock size={14} className="text-orange-500 flex-shrink-0" />
                          À organiser
                        </span>
                      )}
                      {etat === 'partiel' && (
                        <span className="flex items-center gap-1 text-amber-700 font-semibold text-[11px]" title={`${g.realiseeCount} livraison${g.realiseeCount > 1 ? 's' : ''} réalisée${g.realiseeCount > 1 ? 's' : ''} sur ${g.total}`}>
                          <CheckCircle2 size={14} className="text-amber-600 flex-shrink-0" />
                          {g.realiseeCount}/{g.total} livrées
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis" style={frozenTdStyle(1, rowSty.backgroundColor)}>{g.ca.produit?.nom ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis" style={frozenTdStyle(2, rowSty.backgroundColor)}>{g.ca.numero_contrat ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis" style={frozenTdStyle(3, rowSty.backgroundColor)}>{g.ca.fournisseur?.nom ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis" style={frozenTdStyle(4, rowSty.backgroundColor)}>
                      {g.cv?.numero_contrat ? g.cv.numero_contrat : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis" style={frozenTdStyle(5, rowSty.backgroundColor)}>
                      {g.isSilo
                        ? <span className="font-semibold" style={{ color: '#C8941A' }}>{g.clientNom}</span>
                        : <span className="text-gray-800">{g.clientNom}</span>
                      }
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis" style={frozenTdStyle(6, rowSty.backgroundColor)} title={transporteurLabel}>{transporteurLabel || '—'}</td>
                    {moisRange.map(k => {
                      const m = g.marks.get(k)
                      return (
                        <td key={k} className="px-2 py-2 text-center">
                          {m && m.nbRealisee > 0 ? (
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 rounded font-bold text-white text-[11px]"
                              style={{ backgroundColor: '#15803d' }}
                              title={`Réalisée — ${formatT(m.qtyRealisee)}${m.nbRealisee > 1 ? ` (${m.nbRealisee} livraisons)` : ''}`}
                            >✓</span>
                          ) : m && m.nbPlanifiee > 0 ? (
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 rounded font-bold text-white text-[11px]"
                              style={{ backgroundColor: g.ca.famille === 'negoce' ? '#7B2820' : '#2a5570' }}
                              title={`Planifiée — ${formatT(m.qtyPlanifiee)}${m.nbPlanifiee > 1 ? ` (${m.nbPlanifiee} livraisons)` : ''}`}
                            >✕</span>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200" style={{ backgroundColor: '#f3f0ee' }}>
                <td
                  colSpan={7}
                  className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  style={{ position: 'sticky', left: 0, zIndex: 1, backgroundColor: '#f3f0ee', borderRight: '2px solid #e4b5ad' }}
                >
                  Total / mois
                </td>
                {moisRange.map(k => {
                  const rowsDuMois = filtered.filter(r => rowMoisKey(r) === k)
                  const tonnes = rowsDuMois.reduce((s, r) => s + (r.type === 'realisee' ? (r.quantite_reelle ?? 0) : (r.quantite_prevue ?? 0)), 0)
                  const hasRealisee = rowsDuMois.some(r => r.type === 'realisee')
                  const hasPlanifiee = rowsDuMois.some(r => r.type === 'planifiee')
                  return (
                    <td key={k} className="px-2 py-2 text-center whitespace-nowrap">
                      {tonnes > 0 ? (
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: hasRealisee && !hasPlanifiee ? '#dcfce7' : hasPlanifiee && !hasRealisee ? '#fde8e5' : '#fef9c3',
                            color: hasRealisee && !hasPlanifiee ? '#15803d' : hasPlanifiee && !hasRealisee ? '#7B2820' : '#854d0e',
                          }}
                        >
                          {formatT(tonnes)}
                        </span>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bilan totaux */}
        {(() => {
          const realisees = filtered.filter(r => r.type === 'realisee')
          const planifiees = filtered.filter(r => r.type === 'planifiee')
          const tonnesRealisees = realisees.reduce((s, r) => s + (r.quantite_reelle ?? 0), 0)
          const tonnesPlanifiees = planifiees.reduce((s, r) => s + (r.quantite_prevue ?? 0), 0)
          return (
            <div className="flex items-center gap-6 px-4 py-3 border-t-2 border-gray-200 bg-gray-50 text-sm flex-wrap">
              <span className="font-semibold text-gray-500 uppercase tracking-wide text-xs">Totaux ({filtered.length} livraisons)</span>
              <span className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded font-bold text-white text-[10px]" style={{ backgroundColor: '#15803d' }}>✓</span>
                <span className="text-gray-700">
                  <strong className="text-green-700">{realisees.length}</strong> réalisée{realisees.length > 1 ? 's' : ''}
                  <span className="ml-1.5 font-semibold text-green-700">{formatT(tonnesRealisees)}</span>
                </span>
              </span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded font-bold text-white text-[10px]" style={{ backgroundColor: '#7B2820' }}>✕</span>
                <span className="text-gray-700">
                  <strong style={{ color: '#7B2820' }}>{planifiees.length}</strong> planifiée{planifiees.length > 1 ? 's' : ''}
                  <span className="ml-1.5 font-semibold" style={{ color: '#7B2820' }}>{formatT(tonnesPlanifiees)}</span>
                </span>
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-600">
                Total : <strong className="text-gray-800">{formatT(tonnesRealisees + tonnesPlanifiees)}</strong>
              </span>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
