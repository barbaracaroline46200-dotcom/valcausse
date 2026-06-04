'use client'
import { useEffect, useState, useMemo } from 'react'
import { Plus, Loader2, ShoppingCart } from 'lucide-react'
import { BadgeStatut } from '@/components/ui/Badge'
import FilterBar from '@/components/ui/FilterBar'
import { formatTonnes, formatEurosParTonne } from '@/lib/annee-agricole'
import { useAdmin } from '@/components/ui/AdminProvider'
import Link from 'next/link'
import NouvelleVenteSiloModal from '@/components/contrats/NouvelleVenteSiloModal'

export default function VentesPage() {
  const { isAdmin } = useAdmin()
  const [ventes, setVentes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [produits, setProduits] = useState<any[]>([])
  const [agriculteurs, setAgriculteurs] = useState<any[]>([])
  const [fournisseurs, setFournisseurs] = useState<any[]>([])
  const [transporteurs, setTransporteurs] = useState<any[]>([])

  const [filtFamille, setFiltFamille] = useState('')
  const [filtStatut, setFiltStatut] = useState('')
  const [filtProduit, setFiltProduit] = useState('')
  const [filtAgriculteur, setFiltAgriculteur] = useState('')
  const [filtFournisseur, setFiltFournisseur] = useState('')
  const [filtTransporteur, setFiltTransporteur] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/ventes').then(r => r.json()),
      fetch('/api/referentiels/produits').then(r => r.json()),
      fetch('/api/referentiels/agriculteurs').then(r => r.json()),
      fetch('/api/referentiels/fournisseurs').then(r => r.json()),
      fetch('/api/referentiels/transporteurs').then(r => r.json()),
    ]).then(([v, p, a, f, t]) => { setVentes(v); setProduits(p); setAgriculteurs(a); setFournisseurs(f); setTransporteurs(t); setLoading(false) })
  }, [])

  function reload() { fetch('/api/ventes').then(r => r.json()).then(setVentes) }

  const filtered = useMemo(() => ventes.filter(v => {
    if (filtFamille && v.contrat_achat?.famille !== filtFamille) return false
    if (filtStatut && v.statut !== filtStatut) return false
    if (filtProduit && v.produit_id !== filtProduit) return false
    if (filtAgriculteur && v.agriculteur_id !== filtAgriculteur) return false
    if (filtFournisseur && v.contrat_achat?.fournisseur?.id !== filtFournisseur) return false
    if (filtTransporteur && v.contrat_achat?.transporteur?.id !== filtTransporteur) return false
    return true
  }), [ventes, filtFamille, filtStatut, filtProduit, filtAgriculteur, filtFournisseur, filtTransporteur])

  function resetFilters() {
    setFiltFamille(''); setFiltStatut(''); setFiltProduit('')
    setFiltAgriculteur(''); setFiltFournisseur(''); setFiltTransporteur('')
  }

  const filters = [
    { key: 'famille', label: 'Famille', options: [{ value: 'negoce', label: 'Négoce' }, { value: 'appro', label: 'Appro' }], value: filtFamille, onChange: setFiltFamille },
    { key: 'statut', label: 'Statut', options: [{ value: 'en_cours', label: 'En cours' }, { value: 'clos', label: 'Clos' }], value: filtStatut, onChange: setFiltStatut },
    { key: 'produit', label: 'Produit', options: produits.map(p => ({ value: p.id, label: p.nom })), value: filtProduit, onChange: setFiltProduit },
    { key: 'fournisseur', label: 'Fournisseur', options: fournisseurs.map(f => ({ value: f.id, label: f.nom })), value: filtFournisseur, onChange: setFiltFournisseur },
    { key: 'transporteur', label: 'Transporteur', options: transporteurs.map(t => ({ value: t.id, label: t.nom })), value: filtTransporteur, onChange: setFiltTransporteur },
    { key: 'agriculteur', label: 'Agriculteur', options: agriculteurs.map(a => ({ value: a.id, label: a.nom })), value: filtAgriculteur, onChange: setFiltAgriculteur },
  ]

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-green-600" size={32} /></div>

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#7B2820' }}>
            <ShoppingCart size={24} style={{ color: '#C8941A' }} />
            Contrats de vente
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} contrat{filtered.length > 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={16} /> Nouveau (départ silo)
          </button>
        )}
      </div>

      <FilterBar filters={filters} onReset={resetFilters} />

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
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Aucun contrat trouvé</td></tr>
              )}
              {filtered.map(v => (
                <tr key={v.id} className="table-row">
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

      {showModal && (
        <NouvelleVenteSiloModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); reload() }}
        />
      )}
    </div>
  )
}
