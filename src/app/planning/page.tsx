'use client'
import { useEffect, useState, useMemo } from 'react'
import { Loader2, Grid3X3 } from 'lucide-react'

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

export default function PlanningPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtFamille, setFiltFamille] = useState('')
  const [filtProduit, setFiltProduit] = useState('')
  const [filtStatut, setFiltStatut] = useState('en_cours')
  const [filtClient, setFiltClient] = useState('')
  const [filtFournisseur, setFiltFournisseur] = useState('')

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

  const filtered = useMemo(() => rows.filter(r => {
    if (filtFamille && r.contrat_achat?.famille !== filtFamille) return false
    if (filtProduit && r.contrat_achat?.produit?.nom !== filtProduit) return false
    if (filtStatut && r.contrat_achat?.statut !== filtStatut) return false
    if (filtClient && getClientNom(r) !== filtClient) return false
    if (filtFournisseur && r.contrat_achat?.fournisseur?.nom !== filtFournisseur) return false
    return true
  }), [rows, filtFamille, filtProduit, filtStatut, filtClient, filtFournisseur])

  function rowMoisKey(row: any): string | null {
    if (row.type === 'realisee' && row.date_reelle) return row.date_reelle.slice(0, 7)
    if (row.mois_prevu) return row.mois_prevu.slice(0, 7)
    return null
  }

  // Plage de mois couverte par les livraisons filtrées
  const moisRange = useMemo(() => {
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
  }, [filtered])

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
        </div>
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
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
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded text-white text-[10px] font-bold" style={{ backgroundColor: '#15803d' }}>✓</span>
          Réalisée
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded text-white text-[10px] font-bold" style={{ backgroundColor: '#7B2820' }}>✕</span>
          Planifiée
        </span>
        <span className="ml-4 text-gray-400">{filtered.length} livraison{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Tableau scrollable */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <table className="w-full text-xs" style={{ minWidth: `${700 + moisRange.length * 90}px` }}>
            <thead className="sticky top-0 z-10">
              <tr className="border-b-2" style={{ borderColor: '#e4b5ad', backgroundColor: '#fdf5f3' }}>
                {/* Colonnes fixes */}
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap w-20">État</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap w-36">Céréale</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap w-32">N° Contrat</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap w-32">Fournisseur</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap w-32">N° Contrat V.</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap w-44">Agriculteur</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap w-32">Transporteur</th>
                {/* Colonnes mois */}
                {moisRange.map(k => (
                  <th key={k} className="px-2 py-2.5 text-center font-semibold text-gray-600 whitespace-nowrap w-20" style={{ minWidth: 80 }}>
                    {moisShort(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7 + moisRange.length} className="px-4 py-10 text-center text-gray-400">
                    Aucune livraison planifiée correspondant aux filtres
                  </td>
                </tr>
              )}
              {filtered.map((row) => {
                const ca = row.contrat_achat ?? {}
                const cv = row.contrat_vente ?? null
                const isSilo = !!cv?.destination_silo
                const clientNom = getClientNom(row)
                const moisRow = rowMoisKey(row)
                const isRealisee = row.type === 'realisee'

                return (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 hover:brightness-95 transition-all"
                    style={rowStyle(ca.famille, isSilo)}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {ca.statut === 'en_cours'
                        ? <span className="badge-en_cours text-[10px]">En cours</span>
                        : <span className="badge-clos text-[10px]">Clos</span>
                      }
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{ca.produit?.nom ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-gray-700 whitespace-nowrap">{ca.numero_contrat ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{ca.fournisseur?.nom ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">
                      {cv?.numero_contrat ? cv.numero_contrat : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isSilo
                        ? <span className="font-semibold" style={{ color: '#C8941A' }}>{clientNom}</span>
                        : <span className="text-gray-800">{clientNom}</span>
                      }
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{ca.transporteur?.nom ?? '—'}</td>
                    {moisRange.map(k => (
                      <td key={k} className="px-2 py-2 text-center">
                        {moisRow === k
                          ? isRealisee
                            ? <span
                                className="inline-flex items-center justify-center w-6 h-6 rounded font-bold text-white text-[11px]"
                                style={{ backgroundColor: '#15803d' }}
                                title={`Réalisée — ${row.quantite_reelle ?? '?'} t`}
                              >✓</span>
                            : <span
                                className="inline-flex items-center justify-center w-6 h-6 rounded font-bold text-white text-[11px]"
                                style={{ backgroundColor: ca.famille === 'negoce' ? '#7B2820' : '#2a5570' }}
                                title={`Planifiée — ${row.quantite_prevue ?? '?'} t`}
                              >✕</span>
                          : null
                        }
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200" style={{ backgroundColor: '#f3f0ee' }}>
                <td colSpan={7} className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
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
