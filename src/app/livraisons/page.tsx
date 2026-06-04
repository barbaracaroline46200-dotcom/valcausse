'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Truck, Loader2, Trash2 } from 'lucide-react'
import LivraisonAOrganiser from '@/components/livraisons/LivraisonAOrganiser'
import { useAdmin } from '@/components/ui/AdminProvider'

export default function LivraisonsPage() {
  const { isAdmin } = useAdmin()
  const pathname = usePathname()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-green-600" size={32} />
    </div>
  )

  const planifiees = data?.livraisonsPlanifiees ?? []
  const moisCourant = data?.moisCourant ?? ''
  const moisSuivant = data?.moisSuivant ?? ''

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#7B2820' }}>
          <Truck size={22} />
          Livraisons à organiser
          {planifiees.length > 0 && (
            <span className="ml-2 min-w-[24px] h-6 px-2 rounded-full text-white text-sm font-bold flex items-center justify-center" style={{ backgroundColor: '#7B2820' }}>
              {planifiees.length}
            </span>
          )}
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Mois passés non livrés + mois en cours + mois prochain (dès le 20)</p>
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
            <div className="divide-y divide-gray-100">
              {planifiees.map((l: any) => (
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
          </>
        )}
      </div>
    </div>
  )
}
