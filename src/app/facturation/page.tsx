'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { Receipt, Loader2, Trash2, CheckSquare, Square } from 'lucide-react'
import SaisirFactureTransportModal from '@/components/livraisons/SaisirFactureTransportModal'
import SaisirFactureFournisseurModal from '@/components/livraisons/SaisirFactureFournisseurModal'
import SaisirFactureClientModal from '@/components/livraisons/SaisirFactureClientModal'
import { useAdmin } from '@/components/ui/AdminProvider'
import { formatDate, formatTonnes } from '@/lib/annee-agricole'

export default function FacturationPage() {
  const { isAdmin } = useAdmin()
  const pathname = usePathname()
  const [aFacturer, setAFacturer] = useState<any[]>([])
  const [aVerifierClient, setAVerifierClient] = useState<any[]>([])
  const [aFacturerClient, setAFacturerClient] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [factureTransportModal, setFactureTransportModal] = useState<any>(null)
  const [factureFournisseurModal, setFactureFournisseurModal] = useState<any>(null)
  const [factureClientModal, setFactureClientModal] = useState<any[]| null>(null)
  const [cochage, setCochage] = useState<string | null>(null)
  const [selectionSaisie, setSelectionSaisie] = useState<Set<string>>(new Set())

  const reload = useCallback(async () => {
    const res = await fetch('/api/dashboard')
    const d = await res.json()
    setAFacturer(d.livraisonsAFacturer ?? [])
    setAVerifierClient(d.livraisonsAVerifierClient ?? [])
    setAFacturerClient(d.livraisonsAFacturerClient ?? [])
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

  async function cocherVerifClient(livraison: any) {
    setCochage(livraison.id)
    await fetch(`/api/livraisons/${livraison.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifie_client: true }),
    })
    setCochage(null)
    reload()
  }

  function toggleSelection(id: string) {
    setSelectionSaisie(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function ouvrirSaisieClient() {
    const livs = aFacturerClient.filter(l => selectionSaisie.has(l.id))
    if (livs.length === 0) return
    setFactureClientModal(livs)
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

  const total = transportEnAttente.length + fournisseurEnAttente.length + aVerifierClient.length + aFacturerClient.length

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

  const hasFiltresF = filtFProduit || filtFAgriculteur || filtFPoids
  const transportFiltres = useMemo(() => applyFiltres(transportEnAttente), [transportEnAttente, filtFProduit, filtFAgriculteur, filtFPoids])
  const fournisseurFiltres = useMemo(() => applyFiltres(fournisseurEnAttente), [fournisseurEnAttente, filtFProduit, filtFAgriculteur, filtFPoids])

  const [onglet, setOnglet] = useState<'transport' | 'fournisseur' | 'client'>('transport')
  const [sousOngletClient, setSousOngletClient] = useState<'verif' | 'saisir'>('verif')

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
        <p className="text-gray-500 text-sm mt-0.5">Transport · Fournisseur · Vérification et saisie des factures clients</p>
      </div>

      {/* Onglets principaux */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'transport',   label: 'Transport',   count: transportEnAttente.length,  color: '#d97706' },
          { key: 'fournisseur', label: 'Fournisseur', count: fournisseurEnAttente.length, color: '#7B2820' },
          { key: 'client',      label: 'Client',      count: aVerifierClient.length + aFacturerClient.length, color: '#448ab5' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setOnglet(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              onglet === tab.key ? 'border-current' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
            style={onglet === tab.key ? { color: tab.color } : {}}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full text-white text-xs font-bold flex items-center justify-center"
                style={{ backgroundColor: tab.color }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filtres (transport + fournisseur) */}
      {onglet !== 'client' && aFacturer.length > 0 && (
        <div className="card flex gap-2 items-center flex-wrap py-3">
          <input type="text" value={filtFPoids} onChange={e => setFiltFPoids(e.target.value)}
            placeholder="Recherche poids (t)..." className="input text-xs py-1 w-36" />
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

      {/* Onglet Transport */}
      {onglet === 'transport' && (
        <div className="card-section overflow-hidden">
          {transportEnAttente.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">Toutes les factures transport sont saisies 🎉</div>
          ) : transportFiltres.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">Aucun résultat pour ces filtres</div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                {['Date', 'Produit', 'Contrat', 'Agriculteur', 'Tonnes', '', ''].map((h, i) => (
                  <th key={i} className="table-header">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {transportFiltres.map((l: any) => {
                  const ca = l.contrat_achat
                  const agri = getAgriFactu(l)
                  return (
                    <tr key={l.id} className="table-row">
                      <td className="table-cell text-sm">{formatDate(l.date_reelle)}</td>
                      <td className="table-cell font-medium">{ca?.produit?.nom ?? '—'}</td>
                      <td className="table-cell"><a href={`/contrats/${ca?.id}`} className="text-green-700 hover:underline text-sm">{ca?.numero_contrat}</a></td>
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
      )}

      {/* Onglet Fournisseur */}
      {onglet === 'fournisseur' && (
        <div className="card-section overflow-hidden">
          {fournisseurEnAttente.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">Toutes les factures fournisseur sont saisies 🎉</div>
          ) : fournisseurFiltres.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">Aucun résultat pour ces filtres</div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-gray-100">
                {['Date', 'Produit', 'Contrat', 'Agriculteur', 'Tonnes', '', ''].map((h, i) => (
                  <th key={i} className="table-header">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {fournisseurFiltres.map((l: any) => {
                  const ca = l.contrat_achat
                  const agri = getAgriFactu(l)
                  return (
                    <tr key={l.id} className="table-row">
                      <td className="table-cell text-sm">{formatDate(l.date_reelle)}</td>
                      <td className="table-cell font-medium">{ca?.produit?.nom ?? '—'}</td>
                      <td className="table-cell"><a href={`/contrats/${ca?.id}`} className="text-green-700 hover:underline text-sm">{ca?.numero_contrat}</a></td>
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
      )}

      {/* Onglet Client */}
      {onglet === 'client' && (
        <div className="space-y-4">
          {/* Sous-onglets */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            <button
              onClick={() => setSousOngletClient('verif')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sousOngletClient === 'verif' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Vérif Carine
              {aVerifierClient.length > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
                  {aVerifierClient.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setSousOngletClient('saisir'); setSelectionSaisie(new Set()) }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                sousOngletClient === 'saisir' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Saisir N° facture
              {aFacturerClient.length > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: '#448ab5' }}>
                  {aFacturerClient.length}
                </span>
              )}
            </button>
          </div>

          {/* Sous-onglet : Vérif Carine */}
          {sousOngletClient === 'verif' && (
            <div className="card-section overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-amber-50 text-sm text-amber-800">
                Cochez les livraisons que Carine vous a envoyées pour vérification (prix de vente + poids).
                Une fois cochée, la livraison passe dans <strong>Saisir N° facture</strong>.
              </div>
              {aVerifierClient.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-500 text-sm">Aucune livraison en attente de vérification 🎉</div>
              ) : (
                <table className="w-full">
                  <thead><tr className="border-b border-gray-100">
                    {['Date', 'Produit', 'Contrat', 'Agriculteur', 'Tonnes', 'Prix vente', ''].map((h, i) => (
                      <th key={i} className="table-header">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {aVerifierClient.map((l: any) => {
                      const ca = l.contrat_achat
                      const cv = ca?.contrats_vente?.find((v: any) => v.id === l.contrat_vente_id)
                      const agri = cv?.agriculteur
                      return (
                        <tr key={l.id} className="table-row">
                          <td className="table-cell text-sm">{formatDate(l.date_reelle)}</td>
                          <td className="table-cell font-medium">{ca?.produit?.nom ?? '—'}</td>
                          <td className="table-cell">
                            <a href={`/contrats/${ca?.id}`} className="text-green-700 hover:underline text-sm">{ca?.numero_contrat}</a>
                          </td>
                          <td className="table-cell text-sm">{[agri?.civilite, agri?.nom].filter(Boolean).join(' ') || '—'}</td>
                          <td className="table-cell font-semibold">{formatTonnes(l.quantite_reelle)}</td>
                          <td className="table-cell text-sm text-gray-500">
                            {cv?.prix_vente != null ? `${cv.prix_vente} €/t` : '—'}
                          </td>
                          <td className="table-cell text-center">
                            <button
                              onClick={() => cocherVerifClient(l)}
                              disabled={cochage === l.id}
                              className="flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                            >
                              {cochage === l.id
                                ? <Loader2 size={13} className="animate-spin" />
                                : <CheckSquare size={13} />}
                              Vérifié ✓
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Sous-onglet : Saisir N° facture */}
          {sousOngletClient === 'saisir' && (
            <div className="card-section overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-blue-50 flex items-center justify-between gap-4">
                <p className="text-sm text-blue-800">
                  Sélectionnez une ou plusieurs livraisons (même facture) puis cliquez sur <strong>Saisir la facture</strong>.
                </p>
                {selectionSaisie.size > 0 && (
                  <button
                    onClick={ouvrirSaisieClient}
                    className="flex-shrink-0 px-4 py-1.5 rounded-lg text-white text-sm font-semibold transition-colors"
                    style={{ backgroundColor: '#448ab5' }}
                  >
                    Saisir la facture ({selectionSaisie.size})
                  </button>
                )}
              </div>
              {aFacturerClient.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-500 text-sm">Aucune facture à saisir pour l'instant 🎉</div>
              ) : (
                <table className="w-full">
                  <thead><tr className="border-b border-gray-100">
                    {['', 'Date', 'Produit', 'Contrat', 'Agriculteur', 'Tonnes', 'Prix vente'].map((h, i) => (
                      <th key={i} className="table-header">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {aFacturerClient.map((l: any) => {
                      const ca = l.contrat_achat
                      const cv = ca?.contrats_vente?.find((v: any) => v.id === l.contrat_vente_id)
                      const agri = cv?.agriculteur
                      const checked = selectionSaisie.has(l.id)
                      return (
                        <tr
                          key={l.id}
                          className={`table-row cursor-pointer ${checked ? 'bg-blue-50' : ''}`}
                          onClick={() => toggleSelection(l.id)}
                        >
                          <td className="table-cell text-center">
                            {checked
                              ? <CheckSquare size={16} className="text-blue-600 mx-auto" />
                              : <Square size={16} className="text-gray-300 mx-auto" />}
                          </td>
                          <td className="table-cell text-sm">{formatDate(l.date_reelle)}</td>
                          <td className="table-cell font-medium">{ca?.produit?.nom ?? '—'}</td>
                          <td className="table-cell">
                            <a href={`/contrats/${ca?.id}`} className="text-green-700 hover:underline text-sm" onClick={e => e.stopPropagation()}>{ca?.numero_contrat}</a>
                          </td>
                          <td className="table-cell text-sm">{[agri?.civilite, agri?.nom].filter(Boolean).join(' ') || '—'}</td>
                          <td className="table-cell font-semibold">{formatTonnes(l.quantite_reelle)}</td>
                          <td className="table-cell text-sm text-gray-500">
                            {cv?.prix_vente != null ? `${cv.prix_vente} €/t` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

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
      {factureClientModal && (
        <SaisirFactureClientModal
          livraisons={factureClientModal}
          onClose={() => setFactureClientModal(null)}
          onSaved={() => { setFactureClientModal(null); setSelectionSaisie(new Set()); reload() }}
        />
      )}
    </div>
  )
}
