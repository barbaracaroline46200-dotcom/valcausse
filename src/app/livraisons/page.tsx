'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { Truck, Loader2, Trash2 } from 'lucide-react'
import LivraisonAOrganiser from '@/components/livraisons/LivraisonAOrganiser'
import { useAdmin } from '@/components/ui/AdminProvider'

export default function LivraisonsPage() {
  const { isAdmin } = useAdmin()
  const pathname = usePathname()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filtFournisseur, setFiltFournisseur] = useState('')
  const [filtProduit, setFiltProduit] = useState('')
  const [filtAgriculteur, setFiltAgriculteur] = useState('')

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

  const fournisseurs = useMemo(() => [...new Set(planifiees.map((l: any) => l.contrat_achat?.fournisseur?.nom).filter(Boolean))].sort(), [planifiees])
  const produits = useMemo(() => [...new Set(planifiees.map((l: any) => l.contrat_achat?.produit?.nom).filter(Boolean))].sort(), [planifiees])
  const agriculteurs = useMemo(() => [...new Set(planifiees.map((l: any) => getAgriNom(l)).filter(Boolean))].sort(), [planifiees])

  const filtrees = useMemo(() => planifiees.filter((l: any) => {
    if (filtFournisseur && l.contrat_achat?.fournisseur?.nom !== filtFournisseur) return false
    if (filtProduit && l.contrat_achat?.produit?.nom !== filtProduit) return false
    if (filtAgriculteur && getAgriNom(l) !== filtAgriculteur) return false
    return true
  }), [planifiees, filtFournisseur, filtProduit, filtAgriculteur])

  const hasFiltres = filtFournisseur || filtProduit || filtAgriculteur

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
            <select value={filtFournisseur} onChange={e => setFiltFournisseur(e.target.value)} className="input text-sm py-1.5 w-40">
              <option value="">Tous fournisseurs</option>
              {(fournisseurs as string[]).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={filtProduit} onChange={e => setFiltProduit(e.target.value)} className="input text-sm py-1.5 w-40">
              <option value="">Tous produits</option>
              {(produits as string[]).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filtAgriculteur} onChange={e => setFiltAgriculteur(e.target.value)} className="input text-sm py-1.5 w-48">
              <option value="">Tous agriculteurs</option>
              {(agriculteurs as string[]).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            {hasFiltres && (
              <button onClick={() => { setFiltFournisseur(''); setFiltProduit(''); setFiltAgriculteur('') }}
                className="text-xs text-gray-400 hover:text-gray-600 underline">
                Effacer
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
