'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Loader2, CalendarRange, Download, Warehouse, X, ChevronDown } from 'lucide-react'
import {
  filtrerLignesSilo, trierLignesSilo, totauxParProduit, TYPES_SILO,
  type FiltresRapportSilo, type LigneRapportSilo, type TypeSilo,
} from '@/lib/rapport-silo'

const BRUN = '#7B2820'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function addDaysISO(iso: string, days: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function fmtTonnes(n: number | null | undefined) {
  return n != null ? `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} t` : '—'
}
function fmtLigneDate(l: LigneRapportSilo) {
  return l.date ? new Date(l.date).toLocaleDateString('fr-FR') : (l.periodeLabel || '—')
}

// ── Dropdown multi-sélection ────────────────────────────────────────────────
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
        className={`input text-sm py-1.5 flex items-center gap-1 w-44 justify-between ${selected.length > 0 ? 'border-orange-400 bg-orange-50' : ''}`}
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
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[12rem] py-1 max-h-64 overflow-y-auto">
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

export default function RapportSiloPage() {
  const [dateDebut, setDateDebut] = useState(todayISO())
  const [dateFin, setDateFin] = useState(addDaysISO(todayISO(), 6))
  const [lignes, setLignes] = useState<LigneRapportSilo[] | null>(null)
  const [loading, setLoading] = useState(true)

  const [filtreProduits, setFiltreProduits] = useState<string[]>([])
  const [filtreFournisseurs, setFiltreFournisseurs] = useState<string[]>([])
  const [filtreTypesSilo, setFiltreTypesSilo] = useState<TypeSilo[]>([])

  const charger = useCallback((debut: string, fin: string) => {
    setLoading(true)
    fetch(`/api/rapport-silo?date_debut=${debut}&date_fin=${fin}`)
      .then(r => r.json())
      .then(d => { setLignes(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { charger(dateDebut, dateFin) }, [dateDebut, dateFin, charger])

  function onChangeDebut(v: string) {
    setDateDebut(v)
    if (dateFin < v) setDateFin(v)
  }
  function onChangeFin(v: string) {
    if (v < dateDebut) return
    setDateFin(v)
  }

  const produits = useMemo(() => {
    const s = new Set<string>()
    ;(lignes ?? []).forEach(l => { if (l.produit && l.produit !== '—') s.add(l.produit) })
    return [...s].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [lignes])

  const fournisseurs = useMemo(() => {
    const s = new Set<string>()
    ;(lignes ?? []).forEach(l => { if (l.fournisseur && l.fournisseur !== '—') s.add(l.fournisseur) })
    return [...s].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [lignes])

  const filtres: FiltresRapportSilo = {
    produits: filtreProduits.length > 0 ? filtreProduits : undefined,
    fournisseurs: filtreFournisseurs.length > 0 ? filtreFournisseurs : undefined,
    typesSilo: filtreTypesSilo.length > 0 ? filtreTypesSilo : undefined,
  }
  const filtresActifs = !!(filtreProduits.length || filtreFournisseurs.length || filtreTypesSilo.length)
  function resetFiltres() {
    setFiltreProduits([]); setFiltreFournisseurs([]); setFiltreTypesSilo([])
  }

  const lignesAffichees = lignes ? trierLignesSilo(filtrerLignesSilo(lignes, filtres)) : []
  const totaux = totauxParProduit(lignesAffichees)
  const totalGeneral = totaux.reduce((s, t) => s + t.total, 0)

  const pdfParams = new URLSearchParams({ date_debut: dateDebut, date_fin: dateFin })
  if (filtreProduits.length > 0) pdfParams.set('produits', filtreProduits.join(','))
  if (filtreFournisseurs.length > 0) pdfParams.set('fournisseurs', filtreFournisseurs.join(','))
  if (filtreTypesSilo.length > 0) pdfParams.set('types_silo', filtreTypesSilo.join(','))
  const pdfHref = `/api/pdf/rapport-silo?${pdfParams.toString()}`

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: BRUN }}>
            <Warehouse size={24} />
            Rapport silo
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Arrivages prévus et réalisés au silo — document à transmettre</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <CalendarRange size={16} />
            Du
          </div>
          <input type="date" className="input text-sm py-1.5 w-40" value={dateDebut} onChange={e => onChangeDebut(e.target.value)} />
          <span className="text-sm text-gray-500">au</span>
          <input type="date" className="input text-sm py-1.5 w-40" value={dateFin} onChange={e => onChangeFin(e.target.value)} />
          <a
            href={pdfHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors hover:brightness-110"
            style={{ backgroundColor: BRUN }}
          >
            <Download size={16} />
            Télécharger le PDF
          </a>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap">
        <MultiSelect label="Toutes céréales" options={produits} selected={filtreProduits} onChange={setFiltreProduits} />
        <MultiSelect label="Tous fournisseurs" options={fournisseurs} selected={filtreFournisseurs} onChange={setFiltreFournisseurs} />
        <MultiSelect label="Silo + Silo gare" options={[...TYPES_SILO]} selected={filtreTypesSilo} onChange={v => setFiltreTypesSilo(v as TypeSilo[])} />
        {filtresActifs && (
          <button onClick={resetFiltres} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 px-2 py-1.5">
            <X size={14} /> Réinitialiser
          </button>
        )}
      </div>

      {loading || !lignes ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-green-600" size={32} />
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold text-gray-800">Total par céréale</h2>
              {totaux.length > 0 && <span className="text-sm font-semibold" style={{ color: BRUN }}>{fmtTonnes(totalGeneral)} au total</span>}
            </div>
            {totaux.length === 0 ? (
              <p className="px-5 py-6 text-center text-gray-400 text-sm">Aucun arrivage sur cette période (ou filtré par les critères actifs).</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {totaux.map(t => (
                  <div key={t.produit} className="px-5 py-2.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800">{t.produit}</span>
                    <span className="font-semibold" style={{ color: BRUN }}>{fmtTonnes(t.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card overflow-hidden p-0">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <h2 className="font-semibold text-gray-800">Détail des livraisons</h2>
              <span className="text-xs text-gray-400">({lignesAffichees.length})</span>
            </div>
            {lignesAffichees.length === 0 ? (
              <p className="px-5 py-6 text-center text-gray-400 text-sm">Aucun arrivage sur cette période (ou filtré par les critères actifs).</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs table-fixed">
                  <thead style={{ backgroundColor: '#fdf5f3' }}>
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 w-24">Date</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 w-32">Produit</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 w-32">N° Contrat</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 w-32">Fournisseur</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 w-28">Transporteur</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 w-24">Silo</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 w-20">Quantité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignesAffichees.map(l => (
                      <tr key={l.id} className="border-t border-gray-100">
                        <td className={`px-3 py-2 ${l.dateApproximative ? 'text-orange-600 italic' : ''}`}>
                          {l.dateApproximative && '~ '}{fmtLigneDate(l)}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800">{l.produit}</td>
                        <td className="px-3 py-2 font-mono text-gray-600">{l.numeroContrat}</td>
                        <td className="px-3 py-2">{l.fournisseur}</td>
                        <td className="px-3 py-2">{l.transporteur}</td>
                        <td className="px-3 py-2">{l.silo}</td>
                        <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{fmtTonnes(l.quantite)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
