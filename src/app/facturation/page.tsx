'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { Receipt, Loader2, Trash2 } from 'lucide-react'
import SaisirFactureTransportModal from '@/components/livraisons/SaisirFactureTransportModal'
import SaisirFactureFournisseurModal from '@/components/livraisons/SaisirFactureFournisseurModal'
import GererFacturesClientModal from '@/components/livraisons/GererFacturesClientModal'
import { useAdmin } from '@/components/ui/AdminProvider'
import { formatDate, formatTonnes, formatMois } from '@/lib/annee-agricole'

export default function FacturationPage() {
  const { isAdmin } = useAdmin()
  const pathname = usePathname()
  const [aFacturer, setAFacturer] = useState<any[]>([])
  const [facturesMq, setFacturesMq] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [factureTransportModal, setFactureTransportModal] = useState<any>(null)
  const [factureFournisseurModal, setFactureFournisseurModal] = useState<any>(null)
  const [facturesClientModal, setFacturesClientModal] = useState<any>(null)

  const reload = useCallback(async () => {
    const res = await fetch('/api/dashboard')
    const d = await res.json()
    setAFacturer(d.livraisonsAFacturer ?? [])
    setFacturesMq(d.facturesManquantes ?? [])
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

  const [filtFProduit, setFiltFProduit] = useState('')
  const [filtFAgriculteur, setFiltFAgriculteur] = useState('')
  const [filtFPoids, setFiltFPoids] = useState('')

  function getAgriFactu(l: any) {
    const ca = l.contrat_achat
    return ca?.contrats_vente?.find((cv: any) => cv.id === l.contrat_vente_id)?.agriculteur
      ?? ca?.contrats_vente?.[0]?.agriculteur
  }

  const transportEnAttente = useMemo(() => aFacturer.filter((l: any) => !l.transport_facture), [aFacturer])
  const fournisseurEnAttente = useMemo(() => aFacturer.filter((l: any) => !l.facture_fournisseur_id), [aFacturer])

  const total = transportEnAttente.length + fournisseurEnAttente.length + facturesMq.length

  const fProduits = useMemo(() => [...new Set(aFacturer.map((l: any) => l.contrat_achat?.produit?.nom).filter(Boolean))].sort(), [aFacturer])
  const fAgriculteurs = useMemo(() => [...new Set(aFacturer.map((l: any) => getAgriFactu(l)?.nom).filter(Boolean))].sort(), [aFacturer])

  function applyFiltres(list: any[]) {
    return list.filter((l: any) => {
      if (filtFProduit && l.contrat_achat?.produit?.nom !== filtFProduit) return false
      if (filtFAgriculteur && (getAgriFactu(l)?.nom ?? '—') !== filtFAgriculteur) return false
      if (filtFPoids) {
        const poids = String(l.quantite_reelle ?? '')
        if (!poids.includes(filtFPoids.replace(',', '.'))) return false
      }
      return true
    })
  }

  const transportFiltres = useMemo(() => applyFiltres(transportEnAttente), [transportEnAttente, filtFProduit, filtFAgriculteur, filtFPoids])
  const fournisseurFiltres = useMemo(() => applyFiltres(fournisseurEnAttente), [fournisseurEnAttente, filtFProduit, filtFAgriculteur, filtFPoids])

  const hasFiltresF = filtFProduit || filtFAgriculteur || filtFPoids

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-green-600" size={32} />
    </div>
  )

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#448ab5' }}>
          <Receipt size={22} />
          Facturation en attente
          {total > 0 && (
            <span className="ml-2 min-w-[24px] h-6 px-2 rounded-full text-white text-sm font-bold flex items-center justify-center" style={{ backgroundColor: '#448ab5' }}>
              {total}
            </span>
          )}
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Transport &amp; fournisseur à facturer · Factures clients à récupérer dans Atys</p>
      </div>

      {/* Filtres communs */}
      {aFacturer.length > 0 && (
        <div className="card flex gap-2 items-center flex-wrap py-3">
          <input
            type="text"
            value={filtFPoids}
            onChange={e => setFiltFPoids(e.target.value)}
            placeholder="Recherche poids (t)..."
            className="input text-xs py-1 w-36"
          />
          <select value={filtFProduit} onChange={e => setFiltFProduit(e.target.value)} className="input text-xs py-1 w-36">
            <option value="">Tous produits</option>
            {(fProduits as string[]).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filtFAgriculteur} onChange={e => setFiltFAgriculteur(e.target.value)} className="input text-xs py-1 w-44">
            <option value="">Tous agriculteurs</option>
            {(fAgriculteurs as string[]).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {hasFiltresF && (
            <button onClick={() => { setFiltFProduit(''); setFiltFAgriculteur(''); setFiltFPoids('') }}
              className="text-xs text-gray-400 hover:text-gray-600 underline">Effacer</button>
          )}
        </div>
      )}

      {/* Factures transport */}
      <div className="card-section overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <span className="font-semibold text-sm" style={{ color: '#d97706' }}>Factures transport à saisir</span>
          {transportEnAttente.length > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full text-white text-xs font-bold flex items-center justify-center bg-amber-500">
              {hasFiltresF ? `${transportFiltres.length}/${transportEnAttente.length}` : transportEnAttente.length}
            </span>
          )}
        </div>
        {transportEnAttente.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-500 text-sm">Toutes les factures transport sont saisies 🎉</div>
        ) : transportFiltres.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">Aucun résultat pour ces filtres</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Date', 'Produit', 'Contrat', 'Agriculteur', 'Tonnes', '', ''].map((h, i) => (
                  <th key={i} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transportFiltres.map((l: any) => {
                const ca = l.contrat_achat
                const agri = getAgriFactu(l)
                return (
                  <tr key={l.id} className="table-row">
                    <td className="table-cell text-sm">{formatDate(l.date_reelle)}</td>
                    <td className="table-cell font-medium">{ca?.produit?.nom ?? '—'}</td>
                    <td className="table-cell">
                      <a href={`/contrats/${ca?.id}`} className="text-green-700 hover:underline text-sm">{ca?.numero_contrat}</a>
                    </td>
                    <td className="table-cell text-sm">{[agri?.civilite, agri?.nom].filter(Boolean).join(' ') || (l.destination_silo ? 'Silo' : '—')}</td>
                    <td className="table-cell font-semibold">{formatTonnes(l.quantite_reelle)}</td>
                    <td className="table-cell text-center">
                      <button onClick={() => setFactureTransportModal(l)} className="badge-alerte cursor-pointer hover:opacity-80 transition-opacity">⏳ Saisir →</button>
                    </td>
                    {isAdmin && (
                      <td className="table-cell text-center">
                        <button onClick={() => deleteLivraison(l.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded" title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Factures fournisseur */}
      <div className="card-section overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <span className="font-semibold text-sm" style={{ color: '#7B2820' }}>Factures fournisseur à saisir</span>
          {fournisseurEnAttente.length > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: '#7B2820' }}>
              {hasFiltresF ? `${fournisseurFiltres.length}/${fournisseurEnAttente.length}` : fournisseurEnAttente.length}
            </span>
          )}
        </div>
        {fournisseurEnAttente.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-500 text-sm">Toutes les factures fournisseur sont saisies 🎉</div>
        ) : fournisseurFiltres.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">Aucun résultat pour ces filtres</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Date', 'Produit', 'Contrat', 'Agriculteur', 'Tonnes', '', ''].map((h, i) => (
                  <th key={i} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fournisseurFiltres.map((l: any) => {
                const ca = l.contrat_achat
                const agri = getAgriFactu(l)
                return (
                  <tr key={l.id} className="table-row">
                    <td className="table-cell text-sm">{formatDate(l.date_reelle)}</td>
                    <td className="table-cell font-medium">{ca?.produit?.nom ?? '—'}</td>
                    <td className="table-cell">
                      <a href={`/contrats/${ca?.id}`} className="text-green-700 hover:underline text-sm">{ca?.numero_contrat}</a>
                    </td>
                    <td className="table-cell text-sm">{[agri?.civilite, agri?.nom].filter(Boolean).join(' ') || (l.destination_silo ? 'Silo' : '—')}</td>
                    <td className="table-cell font-semibold">{formatTonnes(l.quantite_reelle)}</td>
                    <td className="table-cell text-center">
                      <button onClick={() => setFactureFournisseurModal(l)} className="badge-alerte cursor-pointer hover:opacity-80 transition-opacity">⏳ Saisir →</button>
                    </td>
                    {isAdmin && (
                      <td className="table-cell text-center">
                        <button onClick={() => deleteLivraison(l.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded" title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Factures clients */}
      <div className="card-section overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <span className="font-semibold text-sm" style={{ color: '#7B2820' }}>Factures clients à récupérer dans Atys</span>
          {facturesMq.length > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: '#7B2820' }}>
              {facturesMq.length}
            </span>
          )}
        </div>
        {facturesMq.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-500 text-sm">Toutes les factures clients sont à jour 🎉</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Agriculteur', 'Produit', 'Contrat vente', 'Dernière livraison', 'Mois concernés', ''].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facturesMq.map((item: any) => (
                <tr key={item.contrat_vente_id} className="table-row">
                  <td className="table-cell font-medium">{item.agriculteur?.nom ?? '—'}</td>
                  <td className="table-cell">{item.produit?.nom ?? '—'}</td>
                  <td className="table-cell">
                    <a href={`/contrats/${item.contrat_achat_id}`} className="text-green-700 hover:underline text-sm font-medium">
                      {item.contrat_vente_numero}
                    </a>
                  </td>
                  <td className="table-cell">{formatDate(item.derniere_livraison)}</td>
                  <td className="table-cell text-sm text-gray-600">
                    {item.mois_livraison.map((m: string) => formatMois(m + '-01')).join(', ')}
                  </td>
                  <td className="table-cell text-center">
                    <button
                      onClick={() => setFacturesClientModal(item)}
                      className="badge-alerte cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      ⏳ Saisir factures →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {factureTransportModal && (
        <SaisirFactureTransportModal
          livraison={factureTransportModal}
          onClose={() => setFactureTransportModal(null)}
          onSaved={() => { setFactureTransportModal(null); reload() }}
        />
      )}
      {factureFournisseurModal && (
        <SaisirFactureFournisseurModal
          livraison={factureFournisseurModal}
          onClose={() => setFactureFournisseurModal(null)}
          onSaved={() => { setFactureFournisseurModal(null); reload() }}
        />
      )}
      {facturesClientModal && (
        <GererFacturesClientModal
          contratVente={{
            id: facturesClientModal.contrat_vente_id,
            numero_contrat: facturesClientModal.contrat_vente_numero,
            agriculteur: facturesClientModal.agriculteur,
            factures_client: facturesClientModal.factures_client ?? [],
          }}
          contratAchatId={facturesClientModal.contrat_achat_id}
          onClose={() => setFacturesClientModal(null)}
          onSaved={() => { setFacturesClientModal(null); reload() }}
        />
      )}
    </div>
  )
}
