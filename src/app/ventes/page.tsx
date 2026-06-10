'use client'
import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Loader2, ShoppingCart, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { BadgeStatut } from '@/components/ui/Badge'
import FilterBar from '@/components/ui/FilterBar'
import { formatTonnes, formatEurosParTonne, formatDate } from '@/lib/annee-agricole'
import ProgressBar from '@/components/ui/ProgressBar'
import { useAdmin } from '@/components/ui/AdminProvider'
import Link from 'next/link'
import NouvelleVenteSiloModal from '@/components/contrats/NouvelleVenteSiloModal'
import { useSortable } from '@/lib/useSortable'

function SortHeader({ label, col, sortKey, sortDir, onToggle }: {
  label: string; col: string; sortKey: string; sortDir: 'asc'|'desc'; onToggle: (k: any) => void
}) {
  const active = sortKey === col
  return (
    <th className="table-header cursor-pointer select-none hover:text-gray-700" onClick={() => onToggle(col)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
          : <ChevronsUpDown size={13} className="opacity-30" />}
      </span>
    </th>
  )
}

export default function VentesPage() {
  const { isAdmin } = useAdmin()
  const { sortKey, sortDir, toggle, sort } = useSortable<any>('')
  const searchParams = useSearchParams()
  const q = searchParams.get('q')?.toLowerCase().trim() ?? ''
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

  const filtered = useMemo(() => {
    const base = ventes.filter(v => {
      if (v.statut === 'clos' || v.statut === 'annule') return false
      if (filtFamille && v.contrat_achat?.famille !== filtFamille) return false
      if (filtStatut && v.statut !== filtStatut) return false
      if (filtProduit && v.produit_id !== filtProduit) return false
      if (filtAgriculteur && v.agriculteur_id !== filtAgriculteur) return false
      if (filtFournisseur && v.contrat_achat?.fournisseur?.id !== filtFournisseur) return false
      if (filtTransporteur && v.contrat_achat?.transporteur?.id !== filtTransporteur) return false
      if (q) {
        const haystack = [
          v.numero_contrat,
          v.agriculteur?.nom,
          v.produit?.nom,
          v.contrat_achat?.numero_contrat,
          v.contrat_achat?.fournisseur?.nom,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    return sort(base)
  }, [ventes, filtFamille, filtStatut, filtProduit, filtAgriculteur, filtFournisseur, filtTransporteur, q, sortKey, sortDir])

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
          <p className="text-gray-500 text-sm mt-0.5">
            {filtered.length} contrat{filtered.length > 1 ? 's' : ''} en cours
            <a href="/archives" className="ml-3 text-gray-400 hover:text-gray-600 underline text-xs">→ Voir les archives</a>
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={16} /> Nouveau (départ silo)
          </button>
        )}
      </div>

      {q && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: '#fdf5f3', color: '#7B2820' }}>
          <span>🔍 Recherche : <strong>« {q} »</strong> — {filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
          <a href="/ventes" className="ml-auto text-xs underline opacity-60 hover:opacity-100">Effacer</a>
        </div>
      )}
      <FilterBar filters={filters} onReset={resetFilters} />

      <div className="card-section overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/50">
              <tr>
                    <SortHeader label="N° Contrat"      col="numero_contrat" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
                    <SortHeader label="Agriculteur"      col="agriculteur_id" sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
                    <SortHeader label="Produit"          col="produit_id"     sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
                    <th className="table-header">Contrat achat lié</th>
                    <th className="table-header">Transporteur</th>
                    <SortHeader label="Total"            col="quantite"       sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
                    <th className="table-header">Livré</th>
                    <th className="table-header">Reliquat</th>
                    <SortHeader label="Prix vente"       col="prix_vente"     sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
                    <SortHeader label="Date fin"         col="date_fin"       sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
                    <SortHeader label="Statut"           col="statut"         sortKey={sortKey} sortDir={sortDir} onToggle={toggle} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-400">Aucun contrat trouvé</td></tr>
              )}
              {filtered.map(v => {
                const livsRealisees = (v.livraisons ?? []).filter((l: any) => l.type === 'realisee')
                const livre = livsRealisees.reduce((s: number, l: any) => s + (l.quantite_reelle ?? 0), 0)
                const total = v.quantite ?? 0
                const reliquat = total - livre
                const depasse = v.date_fin && new Date(v.date_fin) < new Date() && reliquat > 0
                return (
                <tr key={v.id} className="table-row">
                  <td className="table-cell font-semibold">
                    <Link href={`/ventes/${v.id}`} className="text-green-700 hover:underline">
                      {v.numero_contrat || <span className="text-gray-400 italic text-xs">Sans n°</span>}
                    </Link>
                  </td>
                  <td className="table-cell font-medium">
                    {v.destination_silo
                      ? <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-medium">🏚 {v.silo_nom ?? 'Silo'}</span>
                      : ([v.agriculteur?.civilite, v.agriculteur?.nom].filter(Boolean).join(' ') || '—')}
                  </td>
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
                  <td className="table-cell font-semibold">{formatTonnes(total)}</td>
                  <td className="table-cell text-sm text-gray-600">
                    {v.contrat_achat?.transporteur?.nom ?? '—'}
                  </td>
                  <td className="table-cell min-w-[120px]">
                    <ProgressBar value={livre} total={total} />
                  </td>
                  <td className="table-cell font-semibold">
                    {reliquat > 0
                      ? <span className="text-orange-600">{formatTonnes(reliquat)}</span>
                      : <span className="text-green-600 text-xs">✓ Soldé</span>}
                  </td>
                  <td className="table-cell">{formatEurosParTonne(v.prix_vente)}</td>
                  <td className="table-cell text-sm">
                    {v.date_fin
                      ? <span className={depasse ? 'text-red-600 font-semibold' : 'text-gray-600'}>{formatDate(v.date_fin)}{depasse ? ' ⚠️' : ''}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="table-cell"><BadgeStatut statut={v.statut} /></td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Bilan totaux */}
        {filtered.length > 0 && (() => {
          const totalContrats = filtered.reduce((s, v) => s + (v.quantite ?? 0), 0)
          const totalLivre = filtered.reduce((s, v) => {
            const livsR = (v.livraisons ?? []).filter((l: any) => l.type === 'realisee')
            return s + livsR.reduce((a: number, l: any) => a + (l.quantite_reelle ?? 0), 0)
          }, 0)
          const totalReliquat = totalContrats - totalLivre
          return (
            <div className="flex items-center gap-6 px-5 py-3 border-t-2 border-gray-100 bg-gray-50 text-sm flex-wrap">
              <span className="font-semibold text-gray-500 uppercase tracking-wide text-xs">
                Totaux — {filtered.length} contrat{filtered.length > 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1.5 text-gray-700">
                📋 Contracté : <strong className="text-gray-900">{formatTonnes(totalContrats)}</strong>
              </span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1.5 text-gray-700">
                ✓ Livré : <strong className="text-green-700">{formatTonnes(totalLivre)}</strong>
              </span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1.5 text-gray-700">
                ⏳ Restant : <strong className={totalReliquat > 0 ? 'text-orange-600' : 'text-green-600'}>{formatTonnes(totalReliquat)}</strong>
              </span>
            </div>
          )
        })()}
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
