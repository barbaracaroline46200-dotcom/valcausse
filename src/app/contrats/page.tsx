'use client'
import { useEffect, useState, useMemo } from 'react'
import { Plus, Loader2, FileText } from 'lucide-react'
import { BadgeFamille, BadgeStatut } from '@/components/ui/Badge'
import FilterBar from '@/components/ui/FilterBar'
import ProgressBar from '@/components/ui/ProgressBar'
import { formatDate, formatTonnes, formatEurosParTonne } from '@/lib/annee-agricole'
import { quantiteLivree, reliquat } from '@/lib/utils'
import Link from 'next/link'
import NouveauContratModal from '@/components/contrats/NouveauContratModal'
import { useAdmin } from '@/components/ui/AdminProvider'

export default function ContratsPage() {
  const { isAdmin } = useAdmin()
  const [contrats, setContrats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
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
  const [agriculteurs, setAgriculteurs] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/contrats').then(r => r.json()),
      fetch('/api/referentiels/produits').then(r => r.json()),
      fetch('/api/referentiels/fournisseurs').then(r => r.json()),
      fetch('/api/referentiels/transporteurs').then(r => r.json()),
      fetch('/api/referentiels/agriculteurs').then(r => r.json()),
    ]).then(([c, p, f, t, a]) => {
      setContrats(c)
      setProduits(p)
      setFournisseurs(f)
      setTransporteurs(t)
      setAgriculteurs(a)
      setLoading(false)
    })
  }, [])

  function reload() {
    fetch('/api/contrats').then(r => r.json()).then(setContrats)
  }

  const filtered = useMemo(() => {
    return contrats.filter(c => {
      if (filtFamille && c.famille !== filtFamille) return false
      if (filtStatut && c.statut !== filtStatut) return false
      if (filtProduit && c.produit_id !== filtProduit) return false
      if (filtFournisseur && c.fournisseur_id !== filtFournisseur) return false
      if (filtTransporteur && c.transporteur_id !== filtTransporteur) return false
      if (filtAgriculteur) {
        const agriIds = (c.contrats_vente ?? []).map((cv: any) => cv.agriculteur_id)
        if (!agriIds.includes(filtAgriculteur)) return false
      }
      return true
    })
  }, [contrats, filtFamille, filtStatut, filtProduit, filtFournisseur, filtTransporteur, filtAgriculteur])

  const filters = [
    { key: 'famille', label: 'Famille', options: [{ value: 'negoce', label: 'Négoce' }, { value: 'appro', label: 'Appro' }], value: filtFamille, onChange: setFiltFamille },
    { key: 'statut', label: 'Statut', options: [{ value: 'en_cours', label: 'En cours' }, { value: 'clos', label: 'Clos' }], value: filtStatut, onChange: setFiltStatut },
    { key: 'produit', label: 'Produit', options: produits.map(p => ({ value: p.id, label: p.nom })), value: filtProduit, onChange: setFiltProduit },
    { key: 'fournisseur', label: 'Fournisseur', options: fournisseurs.map(f => ({ value: f.id, label: f.nom })), value: filtFournisseur, onChange: setFiltFournisseur },
    { key: 'transporteur', label: 'Transporteur', options: transporteurs.map(t => ({ value: t.id, label: t.nom })), value: filtTransporteur, onChange: setFiltTransporteur },
    { key: 'agriculteur', label: 'Agriculteur', options: agriculteurs.map(a => ({ value: a.id, label: a.nom })), value: filtAgriculteur, onChange: setFiltAgriculteur },
  ]

  function resetFilters() {
    setFiltFamille(''); setFiltStatut(''); setFiltProduit(''); setFiltFournisseur(''); setFiltTransporteur(''); setFiltAgriculteur('')
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
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} contrat{filtered.length > 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={16} /> Nouveau contrat
          </button>
        )}
      </div>

      <FilterBar filters={filters} onReset={resetFilters} />

      <div className="card-section overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/50">
              <tr>
                {['N° Contrat', 'Famille', 'Produit', 'Fournisseur', 'Total', 'Livré', 'Reliquat à livrer', 'Non réservé', 'Prix achat', 'Date fin', 'Statut', ''].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-gray-400">Aucun contrat trouvé</td></tr>
              )}
              {filtered.map(c => {
                const livre = quantiteLivree(c.livraisons ?? [])
                const rel = reliquat(c.quantite_totale, c.livraisons ?? [])
                const depasse = c.date_fin && new Date(c.date_fin) < new Date() && c.statut === 'en_cours' && rel > 0
                const totalVendu = (c.contrats_vente ?? []).reduce((s: number, cv: any) => s + (cv.quantite ?? 0), 0)
                const nonReserve = Math.max(0, c.quantite_totale - totalVendu)
                return (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell">
                      <Link href={`/contrats/${c.id}`} className="font-semibold text-green-700 hover:underline">
                        {c.numero_contrat}
                      </Link>
                    </td>
                    <td className="table-cell"><BadgeFamille famille={c.famille} /></td>
                    <td className="table-cell font-medium">{c.produit?.nom ?? '—'}</td>
                    <td className="table-cell">{c.fournisseur?.nom ?? '—'}</td>
                    <td className="table-cell">{formatTonnes(c.quantite_totale)}</td>
                    <td className="table-cell">
                      <div className="min-w-[100px]">
                        <ProgressBar value={livre} total={c.quantite_totale} showLabel={false} />
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
