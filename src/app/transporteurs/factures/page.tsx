'use client'
import { useEffect, useState } from 'react'
import { Truck, Loader2 } from 'lucide-react'
import { formatDate, formatTonnes, formatEuros, getAnneeAgricoleISO, getAnneeAgricoleLabel } from '@/lib/annee-agricole'
import { useAdmin } from '@/components/ui/AdminProvider'

export default function FacturesTransporteurPage() {
  const { isAdmin } = useAdmin()
  const [transporteurs, setTransporteurs] = useState<any[]>([])
  const [selectedT, setSelectedT] = useState('')
  const [selectedMois, setSelectedMois] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [livraisons, setLivraisons] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [annuelle, setAnnuelle] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/referentiels/transporteurs').then(r => r.json()).then(setTransporteurs)
  }, [])

  useEffect(() => {
    if (!selectedT) return
    setLoading(true)
    Promise.all([
      fetch(`/api/livraisons?transporteur_id=${selectedT}&mois=${selectedMois}-01&type=realisee`).then(r => r.json()),
      chargerAnnuel(selectedT),
    ]).then(([liv, ann]) => {
      setLivraisons(liv)
      setAnnuelle(ann)
      setLoading(false)
    })
  }, [selectedT, selectedMois])

  async function chargerAnnuel(transporteurId: string) {
    const { debut, fin } = getAnneeAgricoleISO()
    const livs = await fetch(`/api/livraisons?transporteur_id=${transporteurId}&type=realisee`).then(r => r.json())
    return livs.filter((l: any) => {
      if (!l.date_reelle) return false
      return l.date_reelle >= debut && l.date_reelle <= fin
    })
  }

  async function updateMontantReel(livraisonId: string, montant: string) {
    await fetch(`/api/livraisons/${livraisonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ montant_transport_reel: montant ? parseFloat(montant) : null }),
    })
    const livs = await fetch(`/api/livraisons?transporteur_id=${selectedT}&mois=${selectedMois}-01&type=realisee`).then(r => r.json())
    setLivraisons(livs)
  }

  async function toggleFacture(livraisonId: string, current: boolean) {
    await fetch(`/api/livraisons/${livraisonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transport_facture: !current }),
    })
    const livs = await fetch(`/api/livraisons?transporteur_id=${selectedT}&mois=${selectedMois}-01&type=realisee`).then(r => r.json())
    setLivraisons(livs)
  }

  // montant_transport_reel = prix/tonne réel saisi
  const totalTonnes = livraisons.reduce((s, l) => s + (l.quantite_reelle ?? 0), 0)
  const totalMontantPrevu = livraisons.reduce((s, l) => s + (l.quantite_reelle ?? 0) * (l.contrat_achat?.prix_transport_prevu ?? 0), 0)
  const totalMontantReel = livraisons.reduce((s, l) => s + (l.montant_transport_reel != null ? l.montant_transport_reel * (l.quantite_reelle ?? 0) : 0), 0)
  const totalEcart = totalMontantReel - totalMontantPrevu

  // Annuel
  const annuelPrevu = annuelle.reduce((s, l) => s + (l.quantite_reelle ?? 0) * (l.contrat_achat?.prix_transport_prevu ?? 0), 0)
  const annuelReel = annuelle.reduce((s, l) => s + (l.montant_transport_reel != null ? l.montant_transport_reel * (l.quantite_reelle ?? 0) : 0), 0)

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#7B2820' }}>
          <Truck size={24} style={{ color: '#C8941A' }} />
          Suivi factures transporteur
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Contrôle des factures par transporteur et par mois</p>
      </div>

      {/* Sélecteurs */}
      <div className="card flex gap-4 items-end">
        <div>
          <label className="label">Transporteur</label>
          <select className="input w-60" value={selectedT} onChange={e => setSelectedT(e.target.value)}>
            <option value="">Choisir un transporteur...</option>
            {transporteurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Mois</label>
          <input type="month" className="input w-40" value={selectedMois} onChange={e => setSelectedMois(e.target.value)} />
        </div>
      </div>

      {selectedT && !loading && annuelle.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center border border-blue-100">
            <div className="text-2xl font-bold text-blue-700">{formatEuros(annuelPrevu)}</div>
            <div className="text-xs text-gray-500 mt-1">Transport prévu — année {getAnneeAgricoleLabel()}</div>
          </div>
          <div className="card text-center border border-green-100">
            <div className="text-2xl font-bold text-green-700">{formatEuros(annuelReel)}</div>
            <div className="text-xs text-gray-500 mt-1">Transport facturé</div>
          </div>
          <div className={`card text-center border ${annuelReel - annuelPrevu > 0 ? 'border-red-100' : 'border-green-100'}`}>
            <div className={`text-2xl font-bold ${annuelReel - annuelPrevu > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {annuelReel - annuelPrevu >= 0 ? '+' : ''}{formatEuros(annuelReel - annuelPrevu)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Écart cumulé annuel</div>
          </div>
        </div>
      )}

      {loading && <div className="flex items-center justify-center h-32"><Loader2 className="animate-spin text-green-600" size={24} /></div>}

      {selectedT && !loading && (
        <div className="card-section overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Livraisons du mois — triées par poids réel</h2>
            <p className="text-xs text-gray-500 mt-0.5">Rapprochement avec la facture reçue</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50">
                <tr>
                  {['Enlèvement', 'Destination', 'Date', 'Tonnes', 'Prévu (€/t)', 'Réel (€/t)', 'Montant facture', 'Écart (€)', 'Facturé'].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {livraisons.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Aucune livraison réalisée ce mois</td></tr>
                )}
                {[...livraisons].sort((a, b) => (b.quantite_reelle ?? 0) - (a.quantite_reelle ?? 0)).map(l => {
                  const prixPrev = l.contrat_achat?.prix_transport_prevu ?? null
                  const prixReel = l.montant_transport_reel ?? null
                  const montantFacture = prixReel != null && l.quantite_reelle != null ? prixReel * l.quantite_reelle : null
                  const montantPrevu = prixPrev != null && l.quantite_reelle != null ? prixPrev * l.quantite_reelle : null
                  const ecart = montantFacture != null && montantPrevu != null ? montantFacture - montantPrevu : null
                  return (
                    <tr key={l.id} className="table-row">
                      <td className="table-cell">{l.ville_chargement ?? '—'}</td>
                      <td className="table-cell">{l.ville_destination ?? '—'}</td>
                      <td className="table-cell">{formatDate(l.date_reelle)}</td>
                      <td className="table-cell font-semibold">{formatTonnes(l.quantite_reelle)}</td>
                      <td className="table-cell text-gray-500">{prixPrev != null ? `${prixPrev.toFixed(2)} €/t` : '—'}</td>
                      <td className="table-cell">
                        {isAdmin ? (
                          <input
                            type="number"
                            step="0.001"
                            defaultValue={prixReel ?? ''}
                            onBlur={e => updateMontantReel(l.id, e.target.value)}
                            className="input w-28 py-1 text-sm"
                            placeholder="€/t..."
                          />
                        ) : (prixReel != null ? `${prixReel.toFixed(3)} €/t` : '—')}
                      </td>
                      <td className="table-cell font-semibold">{formatEuros(montantFacture)}</td>
                      <td className="table-cell">
                        {ecart != null && (
                          <span className={`font-bold text-sm ${ecart <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {ecart >= 0 ? '+' : ''}{formatEuros(ecart)}
                          </span>
                        )}
                      </td>
                      <td className="table-cell">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={l.transport_facture}
                            onChange={() => isAdmin && toggleFacture(l.id, l.transport_facture)}
                            disabled={!isAdmin}
                            className="w-4 h-4 rounded accent-green-600"
                          />
                        </label>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {livraisons.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-700">Total</td>
                    <td className="px-4 py-3 text-sm font-bold">{formatTonnes(totalTonnes)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-500">{formatEuros(totalMontantPrevu)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-400 text-xs">—</td>
                    <td className="px-4 py-3 text-sm font-bold">{formatEuros(totalMontantReel)}</td>
                    <td className="px-4 py-3 text-sm font-bold">
                      <span className={totalEcart <= 0 ? 'text-green-600' : 'text-red-600'}>
                        {totalEcart >= 0 ? '+' : ''}{formatEuros(totalEcart)}
                      </span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
