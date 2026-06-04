'use client'
import { useEffect, useState, useMemo } from 'react'
import { Archive, Loader2 } from 'lucide-react'
import { BadgeFamille, BadgeStatut } from '@/components/ui/Badge'
import FilterBar from '@/components/ui/FilterBar'
import ProgressBar from '@/components/ui/ProgressBar'
import { formatDate, formatTonnes, formatEurosParTonne } from '@/lib/annee-agricole'
import { quantiteLivree } from '@/lib/utils'
import Link from 'next/link'

type Tab = 'achat' | 'vente'

export default function ArchivesPage() {
  const [tab, setTab] = useState<Tab>('achat')
  const [contrats, setContrats] = useState<any[]>([])
  const [ventes, setVentes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Référentiels pour filtres
  const [produits, setProduits] = useState<any[]>([])
  const [fournisseurs, setFournisseurs] = useState<any[]>([])
  const [transporteurs, setTransporteurs] = useState<any[]>([])
  const [agriculteurs, setAgriculteurs] = useState<any[]>([])

  // Filtres contrats achat
  const [filtFamilleA, setFiltFamilleA] = useState('')
  const [filtProduitA, setFiltProduitA] = useState('')
  const [filtFournisseurA, setFiltFournisseurA] = useState('')
  const [filtTransporteurA, setFiltTransporteurA] = useState('')
  const [filtAgriculteurA, setFiltAgriculteurA] = useState('')

  // Filtres contrats vente
  const [filtFamilleV, setFiltFamilleV] = useState('')
  const [filtProduitV, setFiltProduitV] = useState('')
  const [filtAgriculteurV, setFiltAgriculteurV] = useState('')
  const [filtFournisseurV, setFiltFournisseurV] = useState('')
  const [filtTransporteurV, setFiltTransporteurV] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/contrats').then(r => r.json()),
      fetch('/api/ventes').then(r => r.json()),
      fetch('/api/referentiels/produits').then(r => r.json()),
      fetch('/api/referentiels/fournisseurs').then(r => r.json()),
      fetch('/api/referentiels/transporteurs').then(r => r.json()),
      fetch('/api/referentiels/agriculteurs').then(r => r.json()),
    ]).then(([c, v, p, f, t, a]) => {
      setContrats((c ?? []).filter((x: any) => x.statut === 'clos' || x.statut === 'annule'))
      setVentes((v ?? []).filter((x: any) => x.statut === 'clos' || x.statut === 'annule'))
      setProduits(p); setFournisseurs(f); setTransporteurs(t); setAgriculteurs(a)
      setLoading(false)
    })
  }, [])

  const filteredContrats = useMemo(() => contrats.filter(c => {
    if (filtFamilleA && c.famille !== filtFamilleA) return false
    if (filtProduitA && c.produit_id !== filtProduitA) return false
    if (filtFournisseurA && c.fournisseur_id !== filtFournisseurA) return false
    if (filtTransporteurA && c.transporteur_id !== filtTransporteurA) return false
    if (filtAgriculteurA) {
      const ids = (c.contrats_vente ?? []).map((cv: any) => cv.agriculteur_id)
      if (!ids.includes(filtAgriculteurA)) return false
    }
    return true
  }), [contrats, filtFamilleA, filtProduitA, filtFournisseurA, filtTransporteurA, filtAgriculteurA])

  const filteredVentes = useMemo(() => ventes.filter(v => {
    if (filtFamilleV && v.contrat_achat?.famille !== filtFamilleV) return false
    if (filtProduitV && v.produit_id !== filtProduitV) return false
    if (filtAgriculteurV && v.agriculteur_id !== filtAgriculteurV) return false
    if (filtFournisseurV && v.contrat_achat?.fournisseur?.id !== filtFournisseurV) return false
    if (filtTransporteurV && v.contrat_achat?.transporteur?.id !== filtTransporteurV) return false
    return true
  }), [ventes, filtFamilleV, filtProduitV, filtAgriculteurV, filtFournisseurV, filtTransporteurV])

  const filtersAchat = [
    { key: 'famille', label: 'Famille', options: [{ value: 'negoce', label: 'Négoce' }, { value: 'appro', label: 'Appro' }], value: filtFamilleA, onChange: setFiltFamilleA },
    { key: 'produit', label: 'Produit', options: produits.map(p => ({ value: p.id, label: p.nom })), value: filtProduitA, onChange: setFiltProduitA },
    { key: 'fournisseur', label: 'Fournisseur', options: fournisseurs.map(f => ({ value: f.id, label: f.nom })), value: filtFournisseurA, onChange: setFiltFournisseurA },
    { key: 'transporteur', label: 'Transporteur', options: transporteurs.map(t => ({ value: t.id, label: t.nom })), value: filtTransporteurA, onChange: setFiltTransporteurA },
    { key: 'agriculteur', label: 'Agriculteur', options: agriculteurs.map(a => ({ value: a.id, label: a.nom })), value: filtAgriculteurA, onChange: setFiltAgriculteurA },
  ]

  const filtersVente = [
    { key: 'famille', label: 'Famille', options: [{ value: 'negoce', label: 'Négoce' }, { value: 'appro', label: 'Appro' }], value: filtFamilleV, onChange: setFiltFamilleV },
    { key: 'produit', label: 'Produit', options: produits.map(p => ({ value: p.id, label: p.nom })), value: filtProduitV, onChange: setFiltProduitV },
    { key: 'fournisseur', label: 'Fournisseur', options: fournisseurs.map(f => ({ value: f.id, label: f.nom })), value: filtFournisseurV, onChange: setFiltFournisseurV },
    { key: 'transporteur', label: 'Transporteur', options: transporteurs.map(t => ({ value: t.id, label: t.nom })), value: filtTransporteurV, onChange: setFiltTransporteurV },
    { key: 'agriculteur', label: 'Agriculteur', options: agriculteurs.map(a => ({ value: a.id, label: a.nom })), value: filtAgriculteurV, onChange: setFiltAgriculteurV },
  ]

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-green-600" size={32} /></div>

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#7B2820' }}>
          <Archive size={22} style={{ color: '#C8941A' }} />
          Archives
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Contrats clos et annulés — lecture seule</p>
      </div>

      {/* Onglets Achat / Vente */}
      <div className="flex border-b border-gray-200">
        {([
          { id: 'achat' as Tab, label: 'Contrats d\'achat', count: filteredContrats.length },
          { id: 'vente' as Tab, label: 'Contrats de vente', count: filteredVentes.length },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
            <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${
              tab === t.id ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Contrats d'achat ── */}
      {tab === 'achat' && (
        <>
          <FilterBar filters={filtersAchat} onReset={() => { setFiltFamilleA(''); setFiltProduitA(''); setFiltFournisseurA(''); setFiltTransporteurA(''); setFiltAgriculteurA('') }} />
          <div className="card-section overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    {['N° Contrat', 'Famille', 'Produit', 'Fournisseur', 'Contrats de vente', 'Total', 'Livré', 'Prix achat', 'Date fin', 'Statut'].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredContrats.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">Aucun contrat archivé</td></tr>
                  )}
                  {filteredContrats.map(c => {
                    const livre = c.gere_par_silo ? c.quantite_totale : quantiteLivree(c.livraisons ?? [])
                    return (
                      <tr key={c.id} className="table-row opacity-80">
                        <td className="table-cell">
                          <Link href={`/contrats/${c.id}`} className="font-semibold text-green-700 hover:underline">
                            {c.numero_contrat}
                          </Link>
                        </td>
                        <td className="table-cell"><BadgeFamille famille={c.famille} /></td>
                        <td className="table-cell font-medium">{c.produit?.nom ?? '—'}</td>
                        <td className="table-cell">{c.fournisseur?.nom ?? '—'}</td>
                        <td className="table-cell">
                          {(c.contrats_vente ?? []).length === 0
                            ? <span className="text-xs text-gray-300">—</span>
                            : (
                              <div className="flex flex-col gap-1">
                                {(c.contrats_vente as any[]).map((cv: any) => (
                                  <span key={cv.id} className="text-xs leading-tight">
                                    <span className="font-semibold text-green-700">{cv.numero_contrat}</span>
                                    {cv.agriculteur?.nom && <span className="text-gray-500"> · {cv.agriculteur.nom}</span>}
                                  </span>
                                ))}
                              </div>
                            )
                          }
                        </td>
                        <td className="table-cell">{formatTonnes(c.quantite_totale)}</td>
                        <td className="table-cell">
                          <div className="min-w-[100px]">
                            <ProgressBar value={livre} total={c.quantite_totale} showLabel={false} />
                            <div className="text-xs text-gray-500 mt-0.5">{formatTonnes(livre)}</div>
                          </div>
                        </td>
                        <td className="table-cell">{formatEurosParTonne(c.prix_achat)}</td>
                        <td className="table-cell">{formatDate(c.date_fin)}</td>
                        <td className="table-cell"><BadgeStatut statut={c.statut} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Contrats de vente ── */}
      {tab === 'vente' && (
        <>
          <FilterBar filters={filtersVente} onReset={() => { setFiltFamilleV(''); setFiltProduitV(''); setFiltAgriculteurV(''); setFiltFournisseurV(''); setFiltTransporteurV('') }} />
          <div className="card-section overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    {['N° Contrat', 'Agriculteur', 'Produit', 'Contrat achat lié', 'Quantité', 'Prix vente', 'Statut'].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredVentes.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Aucun contrat de vente archivé</td></tr>
                  )}
                  {filteredVentes.map(v => (
                    <tr key={v.id} className="table-row opacity-80">
                      <td className="table-cell font-semibold">
                        <Link href={`/ventes/${v.id}`} className="text-green-700 hover:underline">{v.numero_contrat}</Link>
                      </td>
                      <td className="table-cell font-medium">{v.agriculteur?.nom ?? '—'}</td>
                      <td className="table-cell">{v.produit?.nom ?? '—'}</td>
                      <td className="table-cell">
                        {v.contrat_achat ? (
                          <Link href={`/contrats/${v.contrat_achat_id}`} className="text-green-700 hover:underline text-sm">
                            {v.contrat_achat.numero_contrat}
                          </Link>
                        ) : (
                          <span className="badge-appro">Départ silo</span>
                        )}
                      </td>
                      <td className="table-cell font-semibold">{formatTonnes(v.quantite)}</td>
                      <td className="table-cell">{formatEurosParTonne(v.prix_vente)}</td>
                      <td className="table-cell"><BadgeStatut statut={v.statut} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
