'use client'
import { useEffect, useState, useMemo } from 'react'
import { Loader2, BarChart2, TrendingUp, TrendingDown, Wheat, Euro, Truck } from 'lucide-react'
import { formatEuros, formatTonnes, formatEurosParTonne } from '@/lib/annee-agricole'

// ─── helpers ────────────────────────────────────────────────────────────────
function anneeAgricole(date: string | null): string {
  if (!date) return '—'
  const d = new Date(date)
  const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
  return `${y}-${y + 1}`
}

function computeContrat(c: any) {
  const livRealisees = (c.livraisons ?? []).filter((l: any) => l.type === 'realisee')
  const tonnesRealisees = livRealisees.reduce((s: number, l: any) => s + (l.quantite_reelle ?? 0), 0)
  const coutTransport = livRealisees.reduce((s: number, l: any) => s + (l.montant_transport_reel ?? 0), 0)
  const coutFournisseur = (c.factures_fournisseur ?? []).reduce((s: number, f: any) => s + (f.montant_ht ?? 0), 0)
  const caClient = (c.contrats_vente ?? []).flatMap((cv: any) => cv.factures_client ?? []).reduce((s: number, f: any) => s + (f.montant_ht ?? 0), 0)
  const marge = caClient - coutFournisseur - coutTransport

  // théoriques (prix × quantité)
  const coutFournisseurTheo = (c.prix_achat ?? 0) * (c.quantite_totale ?? 0)
  const coutTransportTheo = (c.prix_transport_prevu ?? 0) * (c.quantite_totale ?? 0)
  const caClientTheo = (c.contrats_vente ?? []).reduce((s: number, cv: any) => s + (cv.prix_vente ?? 0) * (cv.quantite ?? 0), 0)
  const margeTheo = caClientTheo - coutFournisseurTheo - coutTransportTheo

  const agriculteurs = [...new Set((c.contrats_vente ?? []).map((cv: any) => cv.agriculteur?.id).filter(Boolean))] as string[]
  const agriculteurNoms = [...new Set((c.contrats_vente ?? []).map((cv: any) => cv.agriculteur?.nom).filter(Boolean))] as string[]

  return {
    ...c,
    tonnesRealisees,
    coutTransport,
    coutFournisseur,
    caClient,
    marge,
    coutFournisseurTheo,
    coutTransportTheo,
    caClientTheo,
    margeTheo,
    agriculteurs,
    agriculteurNoms,
    annee: anneeAgricole(c.date_debut),
  }
}

// ─── KPI card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="card flex items-start gap-4 p-4">
      <div className="rounded-xl p-2.5 flex-shrink-0" style={{ backgroundColor: color + '18' }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── main ─────────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const [raw, setRaw] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [vue, setVue] = useState<'contrat' | 'mois'>('contrat')

  const [filtAnnee, setFiltAnnee] = useState('')
  const [filtFamille, setFiltFamille] = useState('')
  const [filtAgriculteur, setFiltAgriculteur] = useState('')
  const [filtProduit, setFiltProduit] = useState('')
  const [filtFournisseur, setFiltFournisseur] = useState('')
  const [filtTransporteur, setFiltTransporteur] = useState('')

  useEffect(() => {
    fetch('/api/stats', { cache: 'no-store' }).then(r => r.json()).then(d => {
      setRaw((d ?? []).map(computeContrat))
      setLoading(false)
    })
  }, [])

  const annees = useMemo(() => [...new Set(raw.map(c => c.annee).filter(a => a !== '—'))].sort().reverse(), [raw])
  const produits = useMemo(() => [...new Set(raw.map(c => c.produit?.nom).filter(Boolean))].sort() as string[], [raw])
  const fournisseurs = useMemo(() => [...new Set(raw.map(c => c.fournisseur?.nom).filter(Boolean))].sort() as string[], [raw])
  const transporteurs = useMemo(() => [...new Set(raw.map(c => c.transporteur?.nom).filter(Boolean))].sort() as string[], [raw])
  const agriculteurs = useMemo(() => {
    const map = new Map<string, string>()
    raw.forEach(c => {
      ;(c.contrats_vente ?? []).forEach((cv: any) => {
        if (cv.agriculteur?.id) map.set(cv.agriculteur.id, cv.agriculteur.nom)
      })
    })
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [raw])

  const filtered = useMemo(() => raw.filter(c => {
    if (filtAnnee && c.annee !== filtAnnee) return false
    if (filtFamille && c.famille !== filtFamille) return false
    if (filtAgriculteur && !c.agriculteurs.includes(filtAgriculteur)) return false
    if (filtProduit && c.produit?.nom !== filtProduit) return false
    if (filtFournisseur && c.fournisseur?.nom !== filtFournisseur) return false
    if (filtTransporteur && c.transporteur?.nom !== filtTransporteur) return false
    return true
  }), [raw, filtAnnee, filtFamille, filtAgriculteur, filtProduit, filtFournisseur, filtTransporteur])

  // KPIs agrégés
  const kpis = useMemo(() => ({
    ca: filtered.reduce((s, c) => s + c.caClient, 0),
    coutFourn: filtered.reduce((s, c) => s + c.coutFournisseur, 0),
    coutTransport: filtered.reduce((s, c) => s + c.coutTransport, 0),
    marge: filtered.reduce((s, c) => s + c.marge, 0),
    tonnes: filtered.reduce((s, c) => s + c.tonnesRealisees, 0),
  }), [filtered])

  // Vue par mois
  const parMois = useMemo(() => {
    const map = new Map<string, { ca: number; fournisseur: number; transport: number; tonnes: number }>()
    filtered.forEach(c => {
      ;(c.livraisons ?? []).filter((l: any) => l.type === 'realisee' && l.date_reelle).forEach((l: any) => {
        const mois = l.date_reelle.substring(0, 7) // YYYY-MM
        const entry = map.get(mois) ?? { ca: 0, fournisseur: 0, transport: 0, tonnes: 0 }
        const qte = l.quantite_reelle ?? 0
        // Transport direct
        entry.transport += l.montant_transport_reel ?? 0
        entry.tonnes += qte
        // Prorata fournisseur et CA (par tonne livrée / totale)
        if (c.tonnesRealisees > 0) {
          entry.fournisseur += (qte / c.tonnesRealisees) * c.coutFournisseur
          entry.ca += (qte / c.tonnesRealisees) * c.caClient
        }
        map.set(mois, entry)
      })
    })
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mois, d]) => ({ mois, ...d, marge: d.ca - d.fournisseur - d.transport }))
  }, [filtered])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-green-600" size={32} /></div>

  const margePct = kpis.ca > 0 ? (kpis.marge / kpis.ca) * 100 : 0
  const margeParTonne = kpis.tonnes > 0 ? kpis.marge / kpis.tonnes : 0

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#7B2820' }}>
          <BarChart2 size={24} style={{ color: '#C8941A' }} />
          Statistiques
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Résultats financiers par contrat et par période</p>
      </div>

      {/* Filtres */}
      <div className="card flex flex-wrap gap-4 items-end">
        <div>
          <label className="label text-xs">Année agricole</label>
          <select className="input w-40" value={filtAnnee} onChange={e => setFiltAnnee(e.target.value)}>
            <option value="">Toutes</option>
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Catégorie</label>
          <select className="input w-36" value={filtFamille} onChange={e => setFiltFamille(e.target.value)}>
            <option value="">Toutes</option>
            <option value="negoce">Négoce</option>
            <option value="appro">Appro</option>
          </select>
        </div>
        <div>
          <label className="label text-xs">Produit</label>
          <select className="input w-40" value={filtProduit} onChange={e => setFiltProduit(e.target.value)}>
            <option value="">Tous</option>
            {produits.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Fournisseur</label>
          <select className="input w-44" value={filtFournisseur} onChange={e => setFiltFournisseur(e.target.value)}>
            <option value="">Tous</option>
            {fournisseurs.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Transporteur</label>
          <select className="input w-44" value={filtTransporteur} onChange={e => setFiltTransporteur(e.target.value)}>
            <option value="">Tous</option>
            {transporteurs.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Agriculteur (client)</label>
          <select className="input w-48" value={filtAgriculteur} onChange={e => setFiltAgriculteur(e.target.value)}>
            <option value="">Tous</option>
            {agriculteurs.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
          </select>
        </div>
        {(filtAnnee || filtFamille || filtAgriculteur || filtProduit || filtFournisseur || filtTransporteur) && (
          <button
            onClick={() => { setFiltAnnee(''); setFiltFamille(''); setFiltAgriculteur(''); setFiltProduit(''); setFiltFournisseur(''); setFiltTransporteur('') }}
            className="btn-secondary text-sm"
          >
            Effacer filtres
          </button>
        )}
        <div className="ml-auto text-xs text-gray-400 self-center">{filtered.length} contrat{filtered.length > 1 ? 's' : ''}</div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="CA client réel"
          value={formatEuros(kpis.ca)}
          color="#15803d"
          icon={<Euro size={20} />}
        />
        <KpiCard
          label="Coût fournisseur"
          value={formatEuros(kpis.coutFourn)}
          color="#7B2820"
          icon={<TrendingDown size={20} />}
        />
        <KpiCard
          label="Coût transport"
          value={formatEuros(kpis.coutTransport)}
          color="#d97706"
          icon={<Truck size={20} />}
        />
        <KpiCard
          label="Marge nette"
          value={formatEuros(kpis.marge)}
          sub={`${margePct.toFixed(1)} % · ${formatEurosParTonne(margeParTonne)}`}
          color={kpis.marge >= 0 ? '#0284c7' : '#dc2626'}
          icon={<TrendingUp size={20} />}
        />
        <KpiCard
          label="Tonnes réalisées"
          value={formatTonnes(kpis.tonnes)}
          color="#6d28d9"
          icon={<Wheat size={20} />}
        />
      </div>

      {/* Toggle vue */}
      <div className="flex gap-2">
        <button
          onClick={() => setVue('contrat')}
          className={vue === 'contrat' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
        >
          Par contrat
        </button>
        <button
          onClick={() => setVue('mois')}
          className={vue === 'mois' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
        >
          Par mois
        </button>
      </div>

      {/* Table par contrat */}
      {vue === 'contrat' && (
        <div className="card-section overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50">
                <tr>
                  {['N° Contrat', 'Cat.', 'Fournisseur', 'Produit', 'Client(s)', 'Tonnes réalisées', 'Coût fourn.', 'Coût transport', 'CA client', 'Marge €', 'Marge €/t', 'Marge %'].map(h => (
                    <th key={h} className="table-header whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400">Aucun contrat</td></tr>
                )}
                {filtered.map(c => {
                  const margeT = c.tonnesRealisees > 0 ? c.marge / c.tonnesRealisees : 0
                  const pct = c.caClient > 0 ? (c.marge / c.caClient) * 100 : 0
                  const isPositive = c.marge >= 0
                  return (
                    <tr key={c.id} className="table-row">
                      <td className="table-cell font-semibold">
                        <a href={`/contrats/${c.id}`} className="text-green-700 hover:underline">{c.numero_contrat}</a>
                      </td>
                      <td className="table-cell">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${c.famille === 'negoce' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                          {c.famille === 'negoce' ? 'N' : 'A'}
                        </span>
                      </td>
                      <td className="table-cell">{c.fournisseur?.nom ?? '—'}</td>
                      <td className="table-cell">{c.produit?.nom ?? '—'}</td>
                      <td className="table-cell text-xs text-gray-600">{c.agriculteurNoms.join(', ') || '—'}</td>
                      <td className="table-cell font-semibold">{c.tonnesRealisees > 0 ? formatTonnes(c.tonnesRealisees) : <span className="text-gray-300">—</span>}</td>
                      <td className="table-cell">{c.coutFournisseur > 0 ? formatEuros(c.coutFournisseur) : <span className="text-gray-300">—</span>}</td>
                      <td className="table-cell">{c.coutTransport > 0 ? formatEuros(c.coutTransport) : <span className="text-gray-300">—</span>}</td>
                      <td className="table-cell font-semibold text-green-700">{c.caClient > 0 ? formatEuros(c.caClient) : <span className="text-gray-300">—</span>}</td>
                      <td className={`table-cell font-bold ${c.caClient === 0 ? 'text-gray-300' : isPositive ? 'text-blue-700' : 'text-red-600'}`}>
                        {c.caClient > 0 ? formatEuros(c.marge) : '—'}
                      </td>
                      <td className={`table-cell font-semibold ${c.caClient === 0 ? 'text-gray-300' : isPositive ? 'text-blue-600' : 'text-red-500'}`}>
                        {c.caClient > 0 ? formatEurosParTonne(margeT) : '—'}
                      </td>
                      <td className="table-cell">
                        {c.caClient > 0 ? (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {pct.toFixed(1)} %
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {filtered.length > 1 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td className="table-cell font-bold" colSpan={5}>TOTAL ({filtered.length} contrats)</td>
                    <td className="table-cell font-bold">{formatTonnes(kpis.tonnes)}</td>
                    <td className="table-cell font-bold">{formatEuros(kpis.coutFourn)}</td>
                    <td className="table-cell font-bold">{formatEuros(kpis.coutTransport)}</td>
                    <td className="table-cell font-bold text-green-700">{formatEuros(kpis.ca)}</td>
                    <td className={`table-cell font-bold text-lg ${kpis.marge >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatEuros(kpis.marge)}</td>
                    <td className={`table-cell font-bold ${kpis.marge >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatEurosParTonne(margeParTonne)}</td>
                    <td className="table-cell font-bold">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${kpis.marge >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {margePct.toFixed(1)} %
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Table par mois */}
      {vue === 'mois' && (
        <div className="card-section overflow-hidden">
          {parMois.length === 0 ? (
            <p className="px-5 py-10 text-center text-gray-400 text-sm">Aucune livraison réalisée sur la période sélectionnée</p>
          ) : (
            <>
              <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
                ℹ️ Les coûts fournisseur et CA client sont <strong>estimés au prorata des tonnes</strong> par mois — seul le transport est exact.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/50">
                    <tr>
                      {['Mois', 'Tonnes', 'CA client (est.)', 'Coût fourn. (est.)', 'Coût transport', 'Marge (est.)'].map(h => (
                        <th key={h} className="table-header">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parMois.map(row => {
                      const [y, m] = row.mois.split('-')
                      const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                      return (
                        <tr key={row.mois} className="table-row">
                          <td className="table-cell font-semibold capitalize">{label}</td>
                          <td className="table-cell font-semibold">{formatTonnes(row.tonnes)}</td>
                          <td className="table-cell text-green-700">{row.ca > 0 ? formatEuros(row.ca) : <span className="text-gray-300">—</span>}</td>
                          <td className="table-cell">{row.fournisseur > 0 ? formatEuros(row.fournisseur) : <span className="text-gray-300">—</span>}</td>
                          <td className="table-cell">{row.transport > 0 ? formatEuros(row.transport) : <span className="text-gray-300">—</span>}</td>
                          <td className={`table-cell font-bold ${row.marge >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                            {row.ca > 0 ? formatEuros(row.marge) : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td className="table-cell font-bold">TOTAL</td>
                      <td className="table-cell font-bold">{formatTonnes(parMois.reduce((s, r) => s + r.tonnes, 0))}</td>
                      <td className="table-cell font-bold text-green-700">{formatEuros(parMois.reduce((s, r) => s + r.ca, 0))}</td>
                      <td className="table-cell font-bold">{formatEuros(parMois.reduce((s, r) => s + r.fournisseur, 0))}</td>
                      <td className="table-cell font-bold">{formatEuros(parMois.reduce((s, r) => s + r.transport, 0))}</td>
                      <td className={`table-cell font-bold text-lg ${kpis.marge >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatEuros(parMois.reduce((s, r) => s + r.marge, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
