'use client'
import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Loader2, FileText, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { BadgeFamille, BadgeStatut } from '@/components/ui/Badge'
import FilterBar from '@/components/ui/FilterBar'
import ProgressBar from '@/components/ui/ProgressBar'
import { formatDate, formatTonnes, formatEurosParTonne } from '@/lib/annee-agricole'
import { quantiteLivree, reliquat } from '@/lib/utils'
import Link from 'next/link'
import NouveauContratModal from '@/components/contrats/NouveauContratModal'
import { useAdmin } from '@/components/ui/AdminProvider'
import { useSortable } from '@/lib/useSortable'
import AlerteNote from '@/components/ui/AlerteNote'

function SortHeader({ label, col, sortKey, sortDir, onToggle, className }: {
  label: string; col: string; sortKey: string; sortDir: 'asc'|'desc'; onToggle: (k: any) => void; className?: string
}) {
  const active = sortKey === col
  return (
    <th
      className={`table-header cursor-pointer select-none hover:text-gray-700 ${className ?? ''}`}
      onClick={() => onToggle(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
          : <ChevronsUpDown size={13} className="opacity-30" />}
      </span>
    </th>
  )
}

export default function ContratsPage() {
  const { isAdmin } = useAdmin()
  const [contrats, setContrats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { sortKey, sortDir, toggle, sort } = useSortable<any>('')
  const searchParams = useSearchParams()
  const q = searchParams.get('q')?.toLowerCase().trim() ?? ''
  const [showModal, setShowModal] = useState(false)
  const [produits, setProduits] = useState<any[]>([])
  const [fournisseurs, setFournisseurs] = useState<any[]>([])
  const [transporteurs, setTransporteurs] = useState<any[]>([])

  const [filtFamille, setFiltFamille] = useState('')
  const [filtStatut, setFiltStatut] = useState('')
  const [filtProduit, setFiltProduit] = useState('')
  const [filtFournisseur, setFiltFournisseur] = useState('')
  const [filtTransporteur, setFiltTransporteur] = useState('')
  const [filtAgriculteur, setFiltAgriculteur] = useState('')
  const [filtCourtier, setFiltCourtier] = useState('')
  const [agriculteurs, setAgriculteurs] = useState<any[]>([])
  const [courtiers, setCourtiers] = useState<any[]>([])
  const [aArchiver, setAArchiver] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/contrats').then(r => r.json()),
      fetch('/api/referentiels/produits').then(r => r.json()),
      fetch('/api/referentiels/fournisseurs').then(r => r.json()),
      fetch('/api/referentiels/transporteurs').then(r => r.json()),
      fetch('/api/referentiels/agriculteurs').then(r => r.json()),
      fetch('/api/referentiels/courtiers').then(r => r.json()),
      fetch('/api/contrats/a-archiver').then(r => r.json()),
    ]).then(([c, p, f, t, a, co, aa]) => {
      setContrats(c)
      setProduits(p)
      setFournisseurs(f)
      setTransporteurs(t)
      setAgriculteurs(a)
      setCourtiers(Array.isArray(co) ? co : [])
      setAArchiver(Array.isArray(aa) ? aa : [])
      setLoading(false)
    })
  }, [])

  function reload() {
    fetch('/api/contrats').then(r => r.json()).then(setContrats)
  }

  async function marquerClasse(id: string) {
    await fetch(`/api/contrats/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classeur_archive: true }),
    })
    setAArchiver(prev => prev.filter(c => c.id !== id))
  }

  const filtered = useMemo(() => {
    const base = contrats
      .filter(c => {
        if (c.statut === 'clos' || c.statut === 'annule') return false
        if (filtFamille && c.famille !== filtFamille) return false
        if (filtStatut === 'alerte') {
          // En alerte = en cours + date fin dans 30j ou dépassée + reliquat > 0
          const dans30j = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          const rel = c.gere_par_silo ? 0 : (c.quantite_totale ?? 0) - (c.livraisons ?? []).filter((l: any) => l.type === 'realisee').reduce((s: number, l: any) => s + (l.quantite_reelle ?? 0), 0)
          if (c.statut !== 'en_cours' || !c.date_fin || new Date(c.date_fin) > dans30j || rel <= 0) return false
        } else if (filtStatut && c.statut !== filtStatut) return false
        if (filtProduit && c.produit_id !== filtProduit) return false
        if (filtFournisseur && c.fournisseur_id !== filtFournisseur) return false
        if (filtTransporteur && c.transporteur_id !== filtTransporteur) return false
        if (filtAgriculteur) {
          const agriIds = (c.contrats_vente ?? []).map((cv: any) => cv.agriculteur_id)
          if (!agriIds.includes(filtAgriculteur)) return false
        }
        if (filtCourtier && c.courtier_id !== filtCourtier) return false
        if (q) {
          const haystack = [
            c.numero_contrat,
            c.fournisseur?.nom,
            c.produit?.nom,
            c.famille,
            ...(c.contrats_vente ?? []).map((cv: any) => cv.agriculteur?.nom),
          ].filter(Boolean).join(' ').toLowerCase()
          if (!haystack.includes(q)) return false
        }
        return true
      })
      .map(c => {
        // Calcul marge théorique €/t
        const ventes = c.contrats_vente ?? []
        const totalQteVendue = ventes.reduce((s: number, cv: any) => s + (cv.quantite ?? 0), 0)
        const prixVenteMoyen = totalQteVendue > 0
          ? ventes.reduce((s: number, cv: any) => s + (cv.prix_vente ?? 0) * (cv.quantite ?? 0), 0) / totalQteVendue
          : null
        // Transport : coût réel facturé si dispo (montant_transport_reel est un prix/tonne), sinon prix prévu estimé
        const livsRealisees = (c.livraisons ?? []).filter((l: any) => l.type === 'realisee')
        const transportRealTotal = livsRealisees.some((l: any) => l.montant_transport_reel != null)
          ? livsRealisees.reduce((s: number, l: any) => s + (l.montant_transport_reel ?? 0) * (l.quantite_reelle ?? 0), 0)
          : null
        const tonnesRealisees = livsRealisees.reduce((s: number, l: any) => s + (l.quantite_reelle ?? 0), 0)
        const prixTransportParTonne = transportRealTotal != null && tonnesRealisees > 0
          ? transportRealTotal / tonnesRealisees
          : (c.prix_transport_prevu ?? 0)
        const marge = prixVenteMoyen != null && c.prix_achat != null
          ? prixVenteMoyen - c.prix_achat - prixTransportParTonne
          : null
        return { ...c, _prixVenteMoyen: prixVenteMoyen, _marge: marge }
      })
    return sort(base)
  }, [contrats, filtFamille, filtStatut, filtProduit, filtFournisseur, filtTransporteur, filtAgriculteur, filtCourtier, q, sortKey, sortDir])

  // Totaux sur les contrats filtrés
  const totaux = useMemo(() => {
    let contractes = 0, livres = 0, restants = 0
    for (const c of filtered) {
      const isSilo = !!c.gere_par_silo
      const qt = c.quantite_totale ?? 0
      const lv = isSilo ? qt : quantiteLivree(c.livraisons ?? [])
      const re = isSilo ? 0 : reliquat(qt, c.livraisons ?? [])
      contractes += qt
      livres += lv
      restants += re
    }
    return { contractes, livres, restants }
  }, [filtered])

  const filters = [
    { key: 'famille', label: 'Famille', options: [{ value: 'negoce', label: 'Négoce' }, { value: 'appro', label: 'Appro' }], value: filtFamille, onChange: setFiltFamille },
    { key: 'statut', label: 'Statut', options: [{ value: 'en_cours', label: 'En cours' }, { value: 'clos', label: 'Clos' }, { value: 'alerte', label: '⚠️ En alerte' }], value: filtStatut, onChange: setFiltStatut },
    { key: 'produit', label: 'Produit', options: produits.map(p => ({ value: p.id, label: p.nom })), value: filtProduit, onChange: setFiltProduit },
    { key: 'fournisseur', label: 'Fournisseur', options: fournisseurs.map(f => ({ value: f.id, label: f.nom })), value: filtFournisseur, onChange: setFiltFournisseur },
    { key: 'transporteur', label: 'Transporteur', options: transporteurs.map(t => ({ value: t.id, label: t.nom })), value: filtTransporteur, onChange: setFiltTransporteur },
    { key: 'agriculteur', label: 'Agriculteur', options: agriculteurs.map(a => ({ value: a.id, label: a.nom })), value: filtAgriculteur, onChange: setFiltAgriculteur },
    ...(courtiers.length > 0 ? [{ key: 'courtier', label: 'Courtier', options: courtiers.map(c => ({ value: c.id, label: c.nom })), value: filtCourtier, onChange: setFiltCourtier }] : []),
  ]

  function resetFilters() {
    setFiltFamille(''); setFiltStatut(''); setFiltProduit(''); setFiltFournisseur(''); setFiltTransporteur(''); setFiltAgriculteur(''); setFiltCourtier('')
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-green-600" size={32} /></div>

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#7B2820' }}>
            <FileText size={24} style={{ color: '#C8941A' }} />
            Contrats d'achat
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {filtered.length} contrat{filtered.length > 1 ? 's' : ''} en cours
            <a href="/archives" className="ml-3 text-gray-400 hover:text-gray-600 underline text-xs">→ Voir les archives</a>
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={16} /> Nouveau contrat
          </button>
        )}
      </div>

      {aArchiver.length > 0 && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber-800 text-sm">
            <span className="text-lg">📁</span>
            {aArchiver.length === 1
              ? '1 contrat terminé — pensez à le ranger dans votre classeur'
              : `${aArchiver.length} contrats terminés — pensez à les ranger dans votre classeur`}
          </div>
          <div className="flex flex-col gap-1.5">
            {aArchiver.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-200">
                <span className="text-sm font-medium text-gray-700">
                  <span className="font-bold text-amber-900">{c.numero_contrat}</span>
                  {c.produit?.nom && <span className="ml-2 text-gray-500">{c.produit.nom}</span>}
                  {c.fournisseur?.nom && <span className="ml-2 text-gray-400">· {c.fournisseur.nom}</span>}
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{c.statut === 'annule' ? 'Annulé' : 'Clos'}</span>
                </span>
                <button
                  onClick={() => marquerClasse(c.id)}
                  className="ml-4 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1 shrink-0"
                >
                  ✓ Classé
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {q && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: '#fdf5f3', color: '#7B2820' }}>
          <span>🔍 Recherche : <strong>« {q} »</strong> — {filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
          <a href="/contrats" className="ml-auto text-xs underline opacity-60 hover:opacity-100">Effacer</a>
        </div>
      )}
      <FilterBar filters={filters} onReset={resetFilters} />

      <div className="card-section overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/50">
              <tr>
                <SortHeader label="N° Contrat"  col="numero_contrat"  sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
                <SortHeader label="Famille"      col="famille"         sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
                <SortHeader label="Produit"      col="produit_id"      sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
                <SortHeader label="Fournisseur"  col="fournisseur_id"  sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
                <th className="table-header">Transporteur</th>
                <th className="table-header">Contrats de vente</th>
                <SortHeader label="Total"        col="quantite_totale" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
                <th className="table-header">Livré</th>
                <th className="table-header">Reliquat</th>
                <th className="table-header">Non réservé</th>
                <SortHeader label="Prix achat"   col="prix_achat"      sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
                <SortHeader label="Marge est."   col="_marge"          sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
                <SortHeader label="Date fin"     col="date_fin"        sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
                <th className="table-header">Statut</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={15} className="px-4 py-10 text-center text-gray-400">Aucun contrat trouvé</td></tr>
              )}
              {filtered.map(c => {
                const isSilo = !!c.gere_par_silo
                const qte = c.quantite_totale ?? 0
                const livre = isSilo ? qte : quantiteLivree(c.livraisons ?? [])
                const rel = isSilo ? 0 : reliquat(qte, c.livraisons ?? [])
                const depasse = !isSilo && c.date_fin && new Date(c.date_fin) < new Date() && c.statut === 'en_cours' && rel > 0
                const totalVendu = (c.contrats_vente ?? []).reduce((s: number, cv: any) => s + (cv.quantite ?? 0), 0)
                const nonReserve = Math.max(0, qte - totalVendu)
                return (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell">
                      <Link href={`/contrats/${c.id}`} className="font-semibold text-green-700 hover:underline">
                        {c.numero_contrat}
                      </Link>
                      {c.note_alerte && <span className="ml-1.5"><AlerteNote note={c.note_alerte} /></span>}
                      {isSilo && (
                        <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">🏗 Silo</span>
                      )}
                    </td>
                    <td className="table-cell"><BadgeFamille famille={c.famille} /></td>
                    <td className="table-cell font-medium">{c.produit?.nom ?? '—'}</td>
                    <td className="table-cell">{c.fournisseur?.nom ?? '—'}</td>
                    <td className="table-cell text-sm text-gray-600">{c.transporteur?.nom ?? '—'}</td>
                    <td className="table-cell">
                      {(c.contrats_vente ?? []).length === 0
                        ? <span className="text-xs text-gray-300">—</span>
                        : (
                          <div className="flex flex-col gap-1">
                            {(c.contrats_vente as any[]).map((cv: any) => (
                              <span key={cv.id} className="text-xs leading-tight">
                                {cv.destination_silo
                                  ? <span className="font-semibold text-amber-700">🏚 {cv.silo_nom}</span>
                                  : <>
                                      <span className="font-semibold text-green-700">{cv.numero_contrat}</span>
                                      {cv.agriculteur?.nom && <span className="text-gray-500"> · {cv.agriculteur.nom}</span>}
                                      {cv.note_alerte && <span className="ml-1"><AlerteNote note={cv.note_alerte} size={13} /></span>}
                                    </>
                                }
                              </span>
                            ))}
                          </div>
                        )
                      }
                    </td>
                    <td className="table-cell">{formatTonnes(qte)}</td>
                    <td className="table-cell">
                      <div className="min-w-[100px]">
                        <ProgressBar value={livre} total={qte} showLabel={false} />
                        <div className="text-xs text-gray-500 mt-0.5">{formatTonnes(livre)}</div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={`font-bold text-sm ${rel > 0 ? (depasse ? 'text-red-600' : 'text-orange-600') : 'text-green-600'}`}>
                        {formatTonnes(rel)}
                      </span>
                      {depasse && <span className="ml-1">⚠️</span>}
                    </td>
                    <td className="table-cell">
                      {nonReserve > 0
                        ? <span className="font-bold text-sm text-blue-600">{formatTonnes(nonReserve)}</span>
                        : <span className="text-xs text-green-600 font-medium">✓ Complet</span>
                      }
                    </td>
                    <td className="table-cell">{formatEurosParTonne(c.prix_achat)}</td>
                    <td className="table-cell">
                      {c._marge != null ? (
                        <span className={`font-bold text-sm ${c._marge > 0 ? 'text-green-700' : c._marge < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {c._marge > 0 ? '+' : ''}{formatEurosParTonne(c._marge)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className={depasse ? 'text-red-600 font-medium' : ''}>
                        {formatDate(c.date_fin)}
                      </span>
                    </td>
                    <td className="table-cell"><BadgeStatut statut={c.statut} /></td>
                    <td className="table-cell">
                      <Link href={`/contrats/${c.id}`} className="text-xs text-green-700 hover:underline font-medium">
                        Voir →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* ── Ligne de totaux ── */}
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2" style={{ borderColor: '#e4b5ad', backgroundColor: '#fdf5f3' }}>
                  <td colSpan={5} className="px-4 py-3">
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#7B2820' }}>
                      Total — {filtered.length} contrat{filtered.length > 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-sm text-gray-800">{formatTonnes(totaux.contractes)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-sm text-gray-700">{formatTonnes(totaux.livres)}</span>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {totaux.contractes > 0 ? Math.round((totaux.livres / totaux.contractes) * 100) : 0} % livré
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-bold text-sm ${totaux.restants > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {formatTonnes(totaux.restants)}
                    </span>
                  </td>
                  <td colSpan={6} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {showModal && (
        <NouveauContratModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); reload() }}
        />
      )}
    </div>
  )
}
