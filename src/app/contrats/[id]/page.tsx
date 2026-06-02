'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, ArrowLeft, AlertTriangle, Plus, FileDown, Edit, CheckCircle, Pencil, Trash2 } from 'lucide-react'
import { BadgeFamille, BadgeStatut } from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'
import { formatDate, formatTonnes, formatEurosParTonne, formatEuros } from '@/lib/annee-agricole'
import { quantiteLivree, reliquat, ecartTransport } from '@/lib/utils'
import { useAdmin } from '@/components/ui/AdminProvider'
import Link from 'next/link'
import AjouterLivraisonModal from '@/components/livraisons/AjouterLivraisonModal'
import RealiserLivraisonModal from '@/components/livraisons/RealiserLivraisonModal'
import ModifierLivraisonModal from '@/components/livraisons/ModifierLivraisonModal'
import LierVenteModal from '@/components/contrats/LierVenteModal'
import NouvelleVenteModal from '@/components/contrats/NouvelleVenteModal'
import { getPrefixes } from '@/lib/prefixes'

export default function ContratDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { isAdmin } = useAdmin()
  const [contrat, setContrat] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAjoutLiv, setShowAjoutLiv] = useState(false)
  const [realiserLiv, setRealiserLiv] = useState<any>(null)
  const [showLierVente, setShowLierVente] = useState(false)
  const [showNouvelleVente, setShowNouvelleVente] = useState(false)
  const [modifierLiv, setModifierLiv] = useState<any>(null)

  async function reload() {
    const data = await fetch(`/api/contrats/${id}`).then(r => r.json())
    setContrat(data)
    setLoading(false)
  }

  useEffect(() => { reload() }, [id])

  async function toggleStatut() {
    const nouveau = contrat.statut === 'en_cours' ? 'clos' : 'en_cours'
    await fetch(`/api/contrats/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: nouveau }),
    })
    reload()
  }

  async function supprimerLivraison(livId: string) {
    if (!confirm('Supprimer cette livraison ?')) return
    await fetch(`/api/livraisons/${livId}`, { method: 'DELETE' })
    reload()
  }

  async function toggleTransporteurContacte(livId: string, current: boolean) {
    await fetch(`/api/livraisons/${livId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transporteur_contacte: !current }),
    })
    reload()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-green-600" size={32} /></div>
  if (!contrat) return <div className="text-red-600 p-6">Contrat introuvable</div>

  const livre = quantiteLivree(contrat.livraisons ?? [])
  const rel = reliquat(contrat.quantite_totale, contrat.livraisons ?? [])
  const prefixes = getPrefixes(contrat.famille)
  const totalVentes = (contrat.contrats_vente ?? []).reduce((s: number, cv: any) => s + cv.quantite, 0)
  const depassementVente = totalVentes > contrat.quantite_totale

  const livraisonsPlanifiees = (contrat.livraisons ?? []).filter((l: any) => l.type === 'planifiee')
  const livraisonsRealisees = (contrat.livraisons ?? []).filter((l: any) => l.type === 'realisee')

  return (
    <div className="space-y-6 pb-10 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-2">
            <ArrowLeft size={16} /> Retour
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{contrat.numero_contrat}</h1>
            <BadgeFamille famille={contrat.famille} />
            <BadgeStatut statut={contrat.statut} />
          </div>
          <p className="text-gray-500 text-sm mt-1">{contrat.produit?.nom} · {contrat.fournisseur?.nom}</p>
        </div>
        {isAdmin && (
          <button onClick={toggleStatut} className={contrat.statut === 'en_cours' ? 'btn-primary' : 'btn-secondary'}>
            <CheckCircle size={16} />
            {contrat.statut === 'en_cours' ? 'Clôturer' : 'Rouvrir'}
          </button>
        )}
      </div>

      {/* Alerte dépassement vente */}
      {depassementVente && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3">
          <AlertTriangle size={20} className="text-red-600 flex-shrink-0" />
          <div>
            <span className="font-bold text-red-700">Alerte dépassement :</span>
            <span className="text-red-600 ml-1">
              Les contrats de vente ({formatTonnes(totalVentes)}) dépassent la quantité achetée ({formatTonnes(contrat.quantite_totale)}).
            </span>
          </div>
        </div>
      )}

      {/* Informations + barre progression */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Infos contrat */}
        <div className="lg:col-span-2 card space-y-4">
          <h2 className="font-bold text-gray-800 text-base">Informations du contrat</h2>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ['Produit', contrat.produit?.nom],
              ['Famille', contrat.famille === 'negoce' ? 'Négoce' : 'Appro'],
              ['Fournisseur', contrat.fournisseur?.nom],
              ['Référence fournisseur', contrat.reference_fournisseur],
              ['Transporteur', contrat.transporteur?.nom],
              ['Prix achat', formatEurosParTonne(contrat.prix_achat)],
              ['Prix transport prévu', formatEurosParTonne(contrat.prix_transport_prevu)],
              ['Point de chargement', contrat.point_chargement],
              ['Ville chargement', contrat.ville_chargement],
              ['Date début', formatDate(contrat.date_debut)],
              ['Date fin', formatDate(contrat.date_fin)],
              ...(contrat.courtier ? [['Courtier', `${contrat.courtier.nom}${contrat.courtier.numero_courtier ? ` (n° ${contrat.courtier.numero_courtier})` : ''}`]] : []),
              ...(contrat.famille === 'appro' && contrat.numero_mise_a_disposition ? [['N° mise à disposition', contrat.numero_mise_a_disposition]] : []),
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-gray-500 font-medium">{label}</dt>
                <dd className="text-gray-900 mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
          {contrat.notes && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 border border-gray-100">
              {contrat.notes}
            </div>
          )}
        </div>

        {/* Barre de progression */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 text-base">Avancement</h2>
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900">{formatTonnes(livre)}</div>
            <div className="text-gray-500 text-sm">livrées sur {formatTonnes(contrat.quantite_totale)}</div>
          </div>
          <ProgressBar value={livre} total={contrat.quantite_totale} />
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{formatTonnes(rel)}</div>
            <div className="text-xs text-orange-700 font-medium">Reliquat à livrer</div>
          </div>
          <div className={`border rounded-lg p-3 text-center ${totalVentes > contrat.quantite_totale ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className={`text-2xl font-bold ${totalVentes > contrat.quantite_totale ? 'text-red-600' : 'text-blue-700'}`}>
              {formatTonnes(Math.max(0, contrat.quantite_totale - totalVentes))}
            </div>
            <div className={`text-xs font-medium ${totalVentes > contrat.quantite_totale ? 'text-red-600' : 'text-blue-700'}`}>
              {totalVentes > contrat.quantite_totale ? '⚠ Dépassement ventes' : 'Non réservé par un contrat de vente'}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Vendu : {formatTonnes(totalVentes)}</div>
          </div>
        </div>
      </div>

      {/* Contrats de vente liés */}
      <div className="card-section">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Contrats de vente liés</h2>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={() => setShowLierVente(true)} className="btn-secondary text-xs">
                <Plus size={14} /> Lier existant
              </button>
              <button onClick={() => setShowNouvelleVente(true)} className="btn-primary text-xs">
                <Plus size={14} /> Nouveau
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['N° Contrat', 'Agriculteur', 'Produit', 'Quantité', 'Prix vente', 'Statut', 'Facture client'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(contrat.contrats_vente ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">Aucun contrat de vente lié</td></tr>
              )}
              {(contrat.contrats_vente ?? []).map((cv: any) => (
                <tr key={cv.id} className="table-row">
                  <td className="table-cell font-medium text-green-700">{cv.numero_contrat}</td>
                  <td className="table-cell">{cv.agriculteur?.nom ?? '—'}</td>
                  <td className="table-cell">{cv.produit?.nom ?? '—'}</td>
                  <td className="table-cell font-semibold">{formatTonnes(cv.quantite)}</td>
                  <td className="table-cell">{formatEurosParTonne(cv.prix_vente)}</td>
                  <td className="table-cell"><BadgeStatut statut={cv.statut} /></td>
                  <td className="table-cell text-xs">
                    {cv.factures_client?.length > 0
                      ? cv.factures_client.map((f: any) => f.numero_facture_logiciel).join(', ')
                      : <span className="text-orange-500">À récupérer</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Planning des livraisons */}
      <div className="card-section">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Planning des livraisons</h2>
          {isAdmin && (
            <button onClick={() => setShowAjoutLiv(true)} className="btn-primary text-xs">
              <Plus size={14} /> Ajouter livraison planifiée
            </button>
          )}
        </div>

        {/* Planifiées */}
        {livraisonsPlanifiees.length > 0 && (
          <div>
            <div className="px-5 py-2 bg-orange-50 text-xs font-semibold text-orange-700 uppercase tracking-wide">
              Planifiées ({livraisonsPlanifiees.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    {['Mois prévu', 'Client / Destination', 'Tonnes prévues', 'Ville enlèv.', 'Ville dest.', 'Transporteur', 'Pièce fourn.', 'Pièce client', 'Contacté ?', 'Actions'].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {livraisonsPlanifiees.map((l: any) => (
                    <tr key={l.id} className="table-row">
                      <td className="table-cell font-medium">{formatDate(l.mois_prevu)}</td>
                      <td className="table-cell text-xs">
                        {l.destination_silo
                          ? <span className="badge-appro">Silo</span>
                          : l.contrat_vente_id
                            ? <span className="text-green-700 font-medium">{(contrat.contrats_vente ?? []).find((cv: any) => cv.id === l.contrat_vente_id)?.agriculteur?.nom ?? '—'}</span>
                            : <span className="text-gray-400">Non affecté</span>
                        }
                      </td>
                      <td className="table-cell">{formatTonnes(l.quantite_prevue)}</td>
                      <td className="table-cell text-gray-500">{l.ville_chargement ?? contrat.ville_chargement ?? '—'}</td>
                      <td className="table-cell text-gray-500">{l.ville_destination ?? '—'}</td>
                      <td className="table-cell text-gray-500">{contrat.transporteur?.nom ?? '—'}</td>
                      <td className="table-cell text-xs">
                        {l.piece_fournisseur_prefixe && l.piece_fournisseur_numero
                          ? `${l.piece_fournisseur_prefixe} ${l.piece_fournisseur_numero}`
                          : <span className="text-gray-300">{prefixes.fournisseur} —</span>}
                      </td>
                      <td className="table-cell text-xs">
                        {l.piece_client_prefixe && l.piece_client_numero
                          ? `${l.piece_client_prefixe} ${l.piece_client_numero}`
                          : <span className="text-gray-300">{prefixes.client} —</span>}
                      </td>
                      <td className="table-cell">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={l.transporteur_contacte}
                            onChange={() => toggleTransporteurContacte(l.id, l.transporteur_contacte)}
                            disabled={!isAdmin}
                            className="w-4 h-4 rounded accent-green-600"
                          />
                          <span className="text-xs text-gray-500">{l.transporteur_contacte ? 'Oui' : 'Non'}</span>
                        </label>
                      </td>
                      <td className="table-cell">
                        <div className="flex gap-1 flex-wrap">
                          {isAdmin && (
                            <button onClick={() => setRealiserLiv(l)} className="btn-primary text-xs py-1 px-2">
                              Réaliser
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => setModifierLiv(l)} className="btn-secondary text-xs py-1 px-2">
                              <Pencil size={11} />
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => supprimerLivraison(l.id)} className="btn-danger text-xs py-1 px-2">
                              <Trash2 size={11} />
                            </button>
                          )}
                          <a href={`/api/pdf/transporteur?livraison_id=${l.id}`} target="_blank" className="btn-secondary text-xs py-1 px-2">
                            <FileDown size={12} /> PDF
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Réalisées */}
        {livraisonsRealisees.length > 0 && (
          <div>
            <div className="px-5 py-2 bg-green-50 text-xs font-semibold text-green-700 uppercase tracking-wide border-t border-gray-100">
              Réalisées ({livraisonsRealisees.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    {['Date réelle', 'Tonnes réelles', 'Ville enlèv.', 'Ville dest.', 'CMR', 'Pièce fourn.', 'Pièce client', 'Transport prévu', 'Transport réel', 'Écart', 'Facturé'].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {livraisonsRealisees.map((l: any) => {
                    const ecart = ecartTransport(l.montant_transport_reel, l.quantite_reelle, contrat.prix_transport_prevu)
                    const prevu = l.quantite_reelle != null ? l.quantite_reelle * contrat.prix_transport_prevu : null
                    return (
                      <tr key={l.id} className="table-row">
                        <td className="table-cell font-medium">{formatDate(l.date_reelle)}</td>
                        <td className="table-cell font-semibold">{formatTonnes(l.quantite_reelle)}</td>
                        <td className="table-cell text-gray-500">{l.ville_chargement ?? '—'}</td>
                        <td className="table-cell text-gray-500">{l.ville_destination ?? '—'}</td>
                        <td className="table-cell">
                          {l.numero_lettre_voiture
                            ? <span className="badge-clos text-xs">{l.numero_lettre_voiture}</span>
                            : <span className="badge-alerte text-xs">Manquant</span>}
                        </td>
                        <td className="table-cell text-xs">
                          {l.piece_fournisseur_prefixe && l.piece_fournisseur_numero
                            ? `${l.piece_fournisseur_prefixe} ${l.piece_fournisseur_numero}`
                            : '—'}
                        </td>
                        <td className="table-cell text-xs">
                          {l.piece_client_prefixe && l.piece_client_numero
                            ? `${l.piece_client_prefixe} ${l.piece_client_numero}`
                            : '—'}
                        </td>
                        <td className="table-cell text-xs text-gray-500">{formatEuros(prevu)}</td>
                        <td className="table-cell text-xs">{formatEuros(l.montant_transport_reel)}</td>
                        <td className="table-cell">
                          {ecart != null && (
                            <span className={`text-xs font-bold ${ecart <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {ecart >= 0 ? '+' : ''}{formatEuros(ecart)}
                            </span>
                          )}
                        </td>
                        <td className="table-cell">
                          {l.transport_facture
                            ? <span className="badge-clos text-xs">✓</span>
                            : <span className="badge-en_cours text-xs">Non</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(livraisonsPlanifiees.length === 0 && livraisonsRealisees.length === 0) && (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">Aucune livraison enregistrée</div>
        )}
      </div>

      {/* Factures fournisseur */}
      <div className="card-section">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Factures fournisseur</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['N° Facture', 'N° Pièce Atys', 'Montant HT', 'Montant TTC', 'Mode paiement', 'Date paiement'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(contrat.factures_fournisseur ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">
                  {livraisonsRealisees.length > 0
                    ? <span className="text-orange-500 font-medium">⚠️ Des livraisons réalisées n'ont pas encore de facture</span>
                    : 'Aucune facture'}
                </td></tr>
              )}
              {(contrat.factures_fournisseur ?? []).map((f: any) => (
                <tr key={f.id} className="table-row">
                  <td className="table-cell font-medium">{f.numero_facture}</td>
                  <td className="table-cell">{f.numero_piece_logiciel ?? '—'}</td>
                  <td className="table-cell">{formatEuros(f.montant_ht)}</td>
                  <td className="table-cell font-semibold">{formatEuros(f.montant_ttc)}</td>
                  <td className="table-cell">{f.mode_paiement ?? '—'}</td>
                  <td className="table-cell">{formatDate(f.date_paiement)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAjoutLiv && (
        <AjouterLivraisonModal
          contrat={contrat}
          onClose={() => setShowAjoutLiv(false)}
          onSaved={() => { setShowAjoutLiv(false); reload() }}
        />
      )}
      {realiserLiv && (
        <RealiserLivraisonModal
          livraison={realiserLiv}
          contrat={contrat}
          onClose={() => setRealiserLiv(null)}
          onSaved={() => { setRealiserLiv(null); reload() }}
        />
      )}
      {modifierLiv && (
        <ModifierLivraisonModal
          livraison={modifierLiv}
          contrat={contrat}
          onClose={() => setModifierLiv(null)}
          onSaved={() => { setModifierLiv(null); reload() }}
        />
      )}
      {showLierVente && (
        <LierVenteModal
          contratAchatId={id}
          onClose={() => setShowLierVente(false)}
          onSaved={() => { setShowLierVente(false); reload() }}
        />
      )}
      {showNouvelleVente && (
        <NouvelleVenteModal
          contrat={contrat}
          onClose={() => setShowNouvelleVente(false)}
          onSaved={() => { setShowNouvelleVente(false); reload() }}
        />
      )}
    </div>
  )
}
