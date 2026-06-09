'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Truck, Loader2, ChevronDown, X } from 'lucide-react'
import LivraisonAOrganiser from '@/components/livraisons/LivraisonAOrganiser'
import { useAdmin } from '@/components/ui/AdminProvider'

// ── Dropdown multi-sélection ──────────────────────────────────────────────────
function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
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
      ? selected[0]
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
              <span className="leading-tight">{opt}</span>
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

// ── Page principale ───────────────────────────────────────────────────────────
export default function LivraisonsPage() {
  const { isAdmin } = useAdmin()
  const pathname = usePathname()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Filtres multi-sélection
  const [filtFournisseurs, setFiltFournisseurs] = useState<string[]>([])
  const [filtProduits, setFiltProduits] = useState<string[]>([])
  const [filtAgriculteurs, setFiltAgriculteurs] = useState<string[]>([])

  const reload = useCallback(async () => {
    const res = await fetch('/api/dashboard')
    const d = await res.json()
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [])
  useEffect(() => { if (!loading) reload() }, [pathname])
  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  async function deleteLivraison(id: string) {
    if (!window.confirm('Supprimer cette livraison ? Action irréversible.')) return
    const res = await fetch(`/api/livraisons/${id}`, { method: 'DELETE' })
    if (res.ok) reload()
    else alert('Erreur : impossible de supprimer')
  }

  const planifiees = data?.livraisonsPlanifiees ?? []
  const moisCourant = data?.moisCourant ?? ''
  const moisSuivant = data?.moisSuivant ?? ''

  function getAgriNom(l: any) {
    const ca = l.contrat_achat
    const cv = (ca?.contrats_vente ?? []).find((cv: any) => cv.id === l.contrat_vente_id) ?? ca?.contrats_vente?.[0]
    return cv?.agriculteur?.nom ?? null
  }

  const optFournisseurs = useMemo(() => [...new Set(planifiees.map((l: any) => l.contrat_achat?.fournisseur?.nom).filter(Boolean))].sort() as string[], [planifiees])
  const optProduits = useMemo(() => [...new Set(planifiees.map((l: any) => l.contrat_achat?.produit?.nom).filter(Boolean))].sort() as string[], [planifiees])
  const optAgriculteurs = useMemo(() => [...new Set(planifiees.map((l: any) => getAgriNom(l)).filter(Boolean))].sort() as string[], [planifiees])

  const filtrees = useMemo(() => planifiees.filter((l: any) => {
    if (filtFournisseurs.length > 0 && !filtFournisseurs.includes(l.contrat_achat?.fournisseur?.nom)) return false
    if (filtProduits.length > 0 && !filtProduits.includes(l.contrat_achat?.produit?.nom)) return false
    if (filtAgriculteurs.length > 0 && !filtAgriculteurs.includes(getAgriNom(l))) return false
    return true
  }), [planifiees, filtFournisseurs, filtProduits, filtAgriculteurs])

  const hasFiltres = filtFournisseurs.length > 0 || filtProduits.length > 0 || filtAgriculteurs.length > 0
  const nbActifs = filtFournisseurs.length + filtProduits.length + filtAgriculteurs.length

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-green-600" size={32} />
    </div>
  )

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#7B2820' }}>
            <Truck size={22} />
            Livraisons à organiser
            {planifiees.length > 0 && (
              <span className="ml-2 min-w-[24px] h-6 px-2 rounded-full text-white text-sm font-bold flex items-center justify-center" style={{ backgroundColor: '#7B2820' }}>
                {hasFiltres ? `${filtrees.length}/${planifiees.length}` : planifiees.length}
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Mois passés non livrés + mois en cours + mois prochain (dès le 20)</p>
        </div>

        {planifiees.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <MultiSelect label="Fournisseurs" options={optFournisseurs} selected={filtFournisseurs} onChange={setFiltFournisseurs} />
            <MultiSelect label="Produits" options={optProduits} selected={filtProduits} onChange={setFiltProduits} />
            <MultiSelect label="Agriculteurs" options={optAgriculteurs} selected={filtAgriculteurs} onChange={setFiltAgriculteurs} />
            {hasFiltres && (
              <button
                onClick={() => { setFiltFournisseurs([]); setFiltProduits([]); setFiltAgriculteurs([]) }}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <X size={12} /> Tout effacer {nbActifs > 0 && <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-bold">{nbActifs}</span>}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card-section overflow-hidden">
        {planifiees.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-500 text-sm">Aucune livraison en attente 🎉</div>
        ) : (
          <>
            <div className="flex items-center gap-6 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 flex-wrap">
              <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">1</span> Appel agri + date souhaitée</div>
              <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">2</span> PDF envoyé au transporteur</div>
              <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs">3</span> Transporteur confirmé + date/semaine</div>
            </div>
            {filtrees.length === 0 ? (
              <div className="px-5 py-10 text-center text-gray-400 text-sm">Aucune livraison pour ces filtres</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtrees.map((l: any) => (
                  <LivraisonAOrganiser
                    key={l.id}
                    livraison={l}
                    moisCourant={moisCourant}
                    moisSuivant={moisSuivant}
                    isAdmin={isAdmin}
                    onConfirme={reload}
                    onDelete={() => deleteLivraison(l.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
