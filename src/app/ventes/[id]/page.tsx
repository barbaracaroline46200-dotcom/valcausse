'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Pencil, ArrowLeft, Link2, CheckCircle, RotateCcw, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { formatTonnes, formatEurosParTonne, formatEuros, formatDate } from '@/lib/annee-agricole'
import { BadgeStatut, BadgeAnnee, BadgeFamille } from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'
import { useAdmin } from '@/components/ui/AdminProvider'
import { contratSyntheticFromVente, quantiteLivree, reliquat, ecartTransport, nomEntite } from '@/lib/utils'
import { getPrefixes } from '@/lib/prefixes'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import CalendrierContrat from '@/components/ui/CalendrierContrat'
import AjouterLivraisonSiloModal from '@/components/livraisons/AjouterLivraisonSiloModal'
import RealiserLivraisonModal from '@/components/livraisons/RealiserLivraisonModal'
import ModifierLivraisonModal from '@/components/livraisons/ModifierLivraisonModal'
import ModifierLivraisonRealiseeModal from '@/components/livraisons/ModifierLivraisonRealiseeModal'
import ModifierFactureClientModal from '@/components/livraisons/ModifierFactureClientModal'
import AlerteNote from '@/components/ui/AlerteNote'
import AvancementLivraison from '@/components/livraisons/AvancementLivraison'

export default function VenteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAdmin } = useAdmin()
  const [vente, setVente] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [showRelierContrat, setShowRelierContrat] = useState(false)
  const [showAjoutLiv, setShowAjoutLiv] = useState(false)
  const [realiserLiv, setRealiserLiv] = useState<any>(null)
  const [modifierLiv, setModifierLiv] = useState<any>(null)
  const [modifierLivRealisee, setModifierLivRealisee] = useState<any>(null)
  const [modifierFactureClient, setModifierFactureClient] = useState<any>(null)

  function reload() {
    fetch(`/api/ventes/${id}`).then(r => r.json()).then(v => { setVente(v); setLoading(false) })
  }

  useEffect(() => { reload() }, [id])

  async function supprimerLivraison(livId: string) {
    if (!confirm('Supprimer cette livraison ?')) return
    await fetch(`/api/livraisons/${livId}`, { method: 'DELETE' })
    reload()
  }

  async function supprimerFactureTransport(livId: string) {
    if (!confirm('Supprimer la facture transport de cette livraison ? Elle repassera en attente de facturation.')) return
    await fetch(`/api/livraisons/${livId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transport_facture: false, numero_facture_transport: null, date_facture_transport: null }),
    })
    reload()
  }

  async function supprimerFactureClient(factureId: string) {
    if (!confirm('Supprimer cette facture client ? Les livraisons concernées repasseront dans "à saisir".')) return
    await fetch(`/api/factures/client/${factureId}`, { method: 'DELETE' })
    reload()
  }

  async function toggleLivraisonFlag(livId: string, field: string, current: boolean) {
    await fetch(`/api/livraisons/${livId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !current }),
    })
    reload()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-green-600" size={32} /></div>
  if (!vente || vente.error) return <div className="p-8 text-red-600">Contrat de vente introuvable.</div>

  const livraisons = vente.livraisons ?? []
  const qteTotale: number = vente.quantite ?? 0
  const livre = quantiteLivree(livraisons)
  const rel = reliquat(qteTotale, livraisons)
  const famille = vente.contrat_achat?.famille ?? vente.produit?.famille ?? 'negoce'
  const prefixes = getPrefixes(famille)
  // Vente directe départ silo (pas de contrat d'achat lié) : les livraisons se
  // gèrent ici. Sinon, elles se gèrent depuis le contrat d'achat lié (un achat
  // peut alimenter plusieurs ventes, la logistique y est centralisée).
  const peutGererLivraisons = !vente.contrat_achat_id

  const livraisonsPlanifiees = livraisons.filter((l: any) => l.type === 'planifiee')
  const livraisonsRealisees = livraisons
    .filter((l: any) => l.type === 'realisee')
    .sort((a: any, b: any) => (a.date_reelle ?? '').localeCompare(b.date_reelle ?? ''))

  return (
    <div className="space-y-6 pb-10 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/ventes" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-2">
            <ArrowLeft size={16} /> Retour
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">
              {vente.numero_contrat || <span className="italic text-gray-400 text-lg">Sans numéro</span>}
            </h1>
            <BadgeFamille famille={famille} />
            <BadgeStatut statut={vente.statut} />
            <BadgeAnnee dateStr={vente.date_debut} />
            {vente.destination_silo && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                🏚 {vente.silo_nom || 'Silo'}
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-1">
            {vente.produit?.nom} · {vente.destination_silo ? 'Stock propre' : nomEntite(vente.agriculteur)}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowRelierContrat(true)} className="btn-secondary">
              <Link2 size={15} /> {vente.contrat_achat ? 'Changer le contrat lié' : 'Lier un contrat d\'achat'}
            </button>
            <button onClick={() => setShowEdit(true)} className="btn-secondary">
              <Pencil size={15} /> Modifier
            </button>
            {vente.statut === 'en_cours' ? (
              <button
                onClick={async () => {
                  if (!confirm('Clore ce contrat de vente ?')) return
                  await fetch(`/api/ventes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut: 'clos' }) })
                  reload()
                }}
                className="btn-primary"
              >
                <CheckCircle size={16} /> Clôturer
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (!confirm('Réouvrir ce contrat de vente ?')) return
                  await fetch(`/api/ventes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut: 'en_cours' }) })
                  reload()
                }}
                className="btn-secondary"
              >
                <RotateCcw size={15} /> Réouvrir
              </button>
            )}
          </div>
        )}
      </div>

      {/* Alerte prix de vente non défini */}
      {!vente.prix_vente && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3">
          <AlertTriangle size={20} className="text-red-600 flex-shrink-0" />
          <div>
            <span className="font-bold text-red-700">Prix de vente non défini.</span>
            <span className="text-red-600 ml-1">Pensez à le renseigner via "Modifier".</span>
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
              ['Produit', vente.produit?.nom],
              ['Famille', famille === 'negoce' ? 'Négoce' : 'Appro'],
              ...(vente.destination_silo ? [] : [['Agriculteur', nomEntite(vente.agriculteur)]]),
              ['Prix vente', formatEurosParTonne(vente.prix_vente)],
              ['Date début', formatDate(vente.date_debut)],
              ['Date fin', formatDate(vente.date_fin)],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-gray-500 font-medium">{label}</dt>
                <dd className="text-gray-900 mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
          {vente.notes && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 border border-gray-100">
              {vente.notes}
            </div>
          )}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Contrat d'achat lié</p>
            {vente.contrat_achat ? (
              <Link href={`/contrats/${vente.contrat_achat.id}`} className="inline-flex items-center gap-2 text-sm flex-wrap">
                <span className="font-semibold text-green-700 hover:underline">{vente.contrat_achat.numero_contrat}</span>
                <span className="text-gray-500">{vente.contrat_achat.fournisseur?.nom} · {vente.contrat_achat.produit?.nom}</span>
              </Link>
            ) : (
              <span className="text-sm text-gray-400 italic">Aucun — vente directe départ silo</span>
            )}
          </div>
        </div>

        {/* Barre de progression */}
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800 text-base">Avancement</h2>
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Contrat total</div>
            <div className="text-3xl font-extrabold text-gray-900">{formatTonnes(qteTotale)}</div>
            <div className="mt-2 text-sm text-gray-500">dont <span className="font-semibold text-gray-700">{formatTonnes(livre)}</span> livrées</div>
          </div>
          <ProgressBar value={livre} total={qteTotale} />
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">{formatTonnes(rel)}</div>
            <div className="text-xs text-orange-700 font-medium">Reliquat à livrer</div>
          </div>
        </div>
      </div>

      {/* Calendrier */}
      {livraisons.length > 0 && (
        <CalendrierContrat livraisons={livraisons} produitNom={vente.produit?.nom} />
      )}

      {/* Planning des livraisons */}
      <div className="card-section">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Planning des livraisons</h2>
          {isAdmin && peutGererLivraisons && (
            <button onClick={() => setShowAjoutLiv(true)} className="btn-primary text-xs">
              <Plus size={14} /> Ajouter livraison planifiée
            </button>
          )}
        </div>
        {!peutGererLivraisons && (
          <p className="px-5 pt-3 text-xs text-gray-400">
            Livraisons gérées depuis le contrat d'achat lié — <Link href={`/contrats/${vente.contrat_achat.id}`} className="text-green-700 hover:underline">{vente.contrat_achat.numero_contrat}</Link>.
          </p>
        )}

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
                    {['Mois prévu', 'Tonnes prévues', 'Ville enlèv.', 'Ville dest.', 'Transporteur', 'Pièce fourn.', 'Pièce client', 'Avancement', ...(peutGererLivraisons ? ['Actions'] : [])].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {livraisonsPlanifiees.map((l: any) => (
                    <tr key={l.id} className="table-row">
                      <td className="table-cell font-medium">
                        {formatDate(l.mois_prevu)}{l.note_alerte && <span className="ml-1"><AlerteNote note={l.note_alerte} size={13} /></span>}
                      </td>
                      <td className="table-cell">{formatTonnes(l.quantite_prevue)}</td>
                      <td className="table-cell text-gray-500">{l.ville_chargement ?? vente.contrat_achat?.ville_chargement ?? '—'}</td>
                      <td className="table-cell text-gray-500">{l.ville_destination ?? '—'}</td>
                      <td className="table-cell text-gray-500">{l.transporteur?.nom ?? vente.contrat_achat?.transporteur?.nom ?? '—'}</td>
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
                        <AvancementLivraison
                          livraison={l}
                          isAdmin={isAdmin && peutGererLivraisons}
                          onToggle={peutGererLivraisons ? toggleLivraisonFlag : undefined}
                        />
                      </td>
                      {peutGererLivraisons && (
                        <td className="table-cell">
                          {isAdmin && (
                            <div className="flex gap-1 flex-wrap">
                              <button onClick={() => setRealiserLiv(l)} className="btn-primary text-xs py-1 px-2">Réaliser</button>
                              <button onClick={() => setModifierLiv(l)} className="btn-secondary text-xs py-1 px-2"><Pencil size={11} /></button>
                              <button onClick={() => supprimerLivraison(l.id)} className="btn-danger text-xs py-1 px-2"><Trash2 size={11} /></button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Réalisées */}
        {livraisonsRealisees.length > 0 && (
          <div className="border-t-4 border-green-200">
            <div className="px-5 py-2.5 bg-green-600 text-xs font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-white/70" />
              Réalisées ({livraisonsRealisees.length})
            </div>
            <div className="overflow-x-auto bg-green-50/30">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-green-100 bg-green-50/60">
                    {['Date réelle', 'Tonnes réelles', 'Ville enlèv.', 'Ville dest.', 'CMR', 'Pièce fourn.', 'Pièce client', 'Transport prévu', 'Transport réel', 'Écart', 'Facturé', ...(peutGererLivraisons ? [''] : [])].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {livraisonsRealisees.map((l: any) => {
                    const prevu = vente.contrat_achat?.prix_transport_prevu ?? null
                    const ecart = ecartTransport(l.montant_transport_reel, prevu)
                    return (
                      <tr key={l.id} className="table-row bg-green-50/40 hover:bg-green-50/80">
                        <td className="table-cell font-medium">
                          {formatDate(l.date_reelle)}{l.note_alerte && <span className="ml-1"><AlerteNote note={l.note_alerte} size={13} /></span>}
                        </td>
                        <td className="table-cell font-semibold">{formatTonnes(l.quantite_reelle)}</td>
                        <td className="table-cell text-gray-500">{l.ville_chargement ?? '—'}</td>
                        <td className="table-cell text-gray-500">{l.ville_destination ?? '—'}</td>
                        <td className="table-cell">
                          {l.numero_lettre_voiture
                            ? <span className="badge-clos text-xs">{l.numero_lettre_voiture}</span>
                            : <span className="badge-alerte text-xs">Manquant</span>}
                        </td>
                        <td className="table-cell text-xs">
                          {l.piece_fournisseur_prefixe && l.piece_fournisseur_numero ? `${l.piece_fournisseur_prefixe} ${l.piece_fournisseur_numero}` : '—'}
                        </td>
                        <td className="table-cell text-xs">
                          {l.piece_client_prefixe && l.piece_client_numero ? `${l.piece_client_prefixe} ${l.piece_client_numero}` : '—'}
                        </td>
                        <td className="table-cell text-xs text-gray-500">{prevu != null ? formatEurosParTonne(prevu) : '—'}</td>
                        <td className="table-cell text-xs">{l.montant_transport_reel != null ? formatEurosParTonne(l.montant_transport_reel) : '—'}</td>
                        <td className="table-cell">
                          {ecart != null && (
                            <span className={`text-xs font-bold ${ecart <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {ecart >= 0 ? '+' : ''}{formatEurosParTonne(ecart)}
                            </span>
                          )}
                        </td>
                        <td className="table-cell">
                          {l.transport_facture ? (
                            <div className="flex items-center gap-1.5">
                              <span className="badge-clos text-xs">✓</span>
                              {isAdmin && peutGererLivraisons && (
                                <button onClick={() => supprimerFactureTransport(l.id)} className="text-gray-300 hover:text-red-500 transition-colors p-0.5 rounded" title="Supprimer la facture transport">
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="badge-en_cours text-xs">Non</span>
                          )}
                        </td>
                        {peutGererLivraisons && (
                          <td className="table-cell">
                            {isAdmin && (
                              <div className="flex gap-1">
                                <button onClick={() => setModifierLivRealisee(l)} className="btn-secondary text-xs py-1 px-2"><Pencil size={11} /></button>
                                <button onClick={() => supprimerLivraison(l.id)} className="btn-danger text-xs py-1 px-2"><Trash2 size={11} /></button>
                              </div>
                            )}
                          </td>
                        )}
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

      {/* Chiffres clés */}
      {(() => {
        const facturesClient = vente.factures_client ?? []
        const caClient = facturesClient.reduce((s: number, f: any) => s + (f.montant_ht ?? 0), 0)
        const coutTransport = livraisonsRealisees.reduce((s: number, l: any) => s + (l.montant_transport_reel ?? 0) * (l.quantite_reelle ?? 0), 0)
        if (caClient === 0 && coutTransport === 0) return null
        return (
          <div className="card">
            <h2 className="font-bold text-gray-800 text-base mb-4">Chiffres clés</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                <p className="text-xs text-green-600 font-medium mb-1">CA client (HT)</p>
                <p className="text-lg font-bold text-green-700">{caClient > 0 ? formatEuros(caClient) : <span className="text-gray-300 text-sm">Non facturé</span>}</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                <p className="text-xs text-amber-600 font-medium mb-1">Coût transport</p>
                <p className="text-lg font-bold text-amber-700">{coutTransport > 0 ? formatEuros(coutTransport) : <span className="text-gray-300 text-sm">—</span>}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Ne comprend pas le coût fournisseur — réparti sur plusieurs ventes le cas échéant, il ne peut être isolé à ce niveau. Voir le contrat d'achat lié pour la marge complète.
            </p>
          </div>
        )
      })()}

      {/* Factures client */}
      <div className="card-section">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Factures client</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['N° Facture', 'Date facture', 'Montant HT', 'Montant TTC', 'Mode paiement', 'Date paiement', ''].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(vente.factures_client ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">
                  {livraisonsRealisees.length > 0
                    ? <span className="text-orange-500 font-medium">⚠️ Des livraisons réalisées n'ont pas encore de facture</span>
                    : 'Aucune facture'}
                </td></tr>
              )}
              {(vente.factures_client ?? []).map((f: any) => (
                <tr key={f.id} className="table-row">
                  <td className="table-cell font-medium">{f.numero_facture_logiciel ?? '—'}</td>
                  <td className="table-cell">{formatDate(f.date_facture)}</td>
                  <td className="table-cell">{formatEuros(f.montant_ht)}</td>
                  <td className="table-cell font-semibold">{formatEuros(f.montant_ttc)}</td>
                  <td className="table-cell">{f.mode_paiement ?? '—'}</td>
                  <td className="table-cell">{formatDate(f.date_paiement)}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setModifierFactureClient(f)} className="text-gray-300 hover:text-blue-500 transition-colors p-1 rounded" title="Modifier cette facture">
                        <Pencil size={14} />
                      </button>
                      {isAdmin && (
                        <button onClick={() => supprimerFactureClient(f.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded" title="Supprimer cette facture">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showEdit && (
        <EditVenteModal vente={vente} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); reload() }} />
      )}
      {showRelierContrat && (
        <RelierContratModal vente={vente} onClose={() => setShowRelierContrat(false)} onSaved={() => { setShowRelierContrat(false); reload() }} />
      )}
      {showAjoutLiv && (
        <AjouterLivraisonSiloModal vente={vente} onClose={() => setShowAjoutLiv(false)} onSaved={() => { setShowAjoutLiv(false); reload() }} />
      )}
      {realiserLiv && (
        <RealiserLivraisonModal
          livraison={realiserLiv}
          contrat={contratSyntheticFromVente(vente)}
          onClose={() => setRealiserLiv(null)}
          onSaved={() => { setRealiserLiv(null); reload() }}
        />
      )}
      {modifierLiv && (
        <ModifierLivraisonModal
          livraison={modifierLiv}
          contrat={contratSyntheticFromVente(vente)}
          onClose={() => setModifierLiv(null)}
          onSaved={() => { setModifierLiv(null); reload() }}
        />
      )}
      {modifierLivRealisee && (
        <ModifierLivraisonRealiseeModal
          livraison={modifierLivRealisee}
          contrat={contratSyntheticFromVente(vente)}
          onClose={() => setModifierLivRealisee(null)}
          onSaved={() => { setModifierLivRealisee(null); reload() }}
        />
      )}
      {modifierFactureClient && (
        <ModifierFactureClientModal
          facture={modifierFactureClient}
          onClose={() => setModifierFactureClient(null)}
          onSaved={() => { setModifierFactureClient(null); reload() }}
        />
      )}
    </div>
  )
}

// Modal modification contrat de vente
function EditVenteModal({ vente, onClose, onSaved }: { vente: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    numero_contrat: vente.numero_contrat ?? '',
    prix_vente: String(vente.prix_vente ?? ''),
    quantite: String(vente.quantite ?? ''),
    statut: vente.statut ?? 'en_cours',
    notes: vente.notes ?? '',
    date_debut: vente.date_debut ?? '',
    date_fin: vente.date_fin ?? '',
  })
  const [agriculteurs, setAgriculteurs] = useState<any[]>([])
  const [agriculteurId, setAgriculteurId] = useState(vente.agriculteur_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/referentiels/agriculteurs').then(r => r.json()).then(setAgriculteurs)
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/ventes/${vente.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero_contrat: form.numero_contrat,
        agriculteur_id: agriculteurId,
        prix_vente: parseFloat(form.prix_vente),
        quantite: parseFloat(form.quantite),
        statut: form.statut,
        notes: form.notes || null,
        date_debut: form.date_debut || null,
        date_fin: form.date_fin || null,
      }),
    })
    if (res.ok) { onSaved() } else { const d = await res.json(); setError(d.error ?? 'Erreur') }
    setSaving(false)
  }

  return (
    <Modal title="Modifier le contrat de vente" onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">N° contrat *</label>
            <input className="input" value={form.numero_contrat} onChange={e => setForm(p => ({ ...p, numero_contrat: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Agriculteur *</label>
            <select className="input" value={agriculteurId} onChange={e => setAgriculteurId(e.target.value)} required>
              <option value="">Choisir...</option>
              {agriculteurs.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Prix vente (€/t) *</label>
            <input type="number" step="0.01" className="input" value={form.prix_vente} onChange={e => setForm(p => ({ ...p, prix_vente: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Quantité (t) *</label>
            <input type="number" step="0.001" className="input" value={form.quantite} onChange={e => setForm(p => ({ ...p, quantite: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Statut</label>
            <select className="input" value={form.statut} onChange={e => setForm(p => ({ ...p, statut: e.target.value }))}>
              <option value="en_cours">En cours</option>
              <option value="clos">Clos</option>
              <option value="annule">Annulé</option>
            </select>
          </div>
          <div>
            <label className="label">Date début contrat</label>
            <input type="date" className="input" value={form.date_debut} onChange={e => setForm(p => ({ ...p, date_debut: e.target.value }))} />
          </div>
          <div>
            <label className="label">Date fin contrat</label>
            <input type="date" className="input" value={form.date_fin} onChange={e => setForm(p => ({ ...p, date_fin: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
        </div>
      </form>
    </Modal>
  )
}

// Modal relier à un autre contrat d'achat
function RelierContratModal({ vente, onClose, onSaved }: { vente: any; onClose: () => void; onSaved: () => void }) {
  const [contrats, setContrats] = useState<any[]>([])
  const [contratId, setContratId] = useState(vente.contrat_achat_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/contrats').then(r => r.json()).then(setContrats)
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/ventes/${vente.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contrat_achat_id: contratId || null }),
    })
    if (res.ok) { onSaved() } else { const d = await res.json(); setError(d.error ?? 'Erreur') }
    setSaving(false)
  }

  return (
    <Modal title="Relier à un contrat d'achat" onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-sm text-blue-700 mb-2">
          Contrat de vente : <strong>{vente.numero_contrat}</strong> · {nomEntite(vente.agriculteur)}
        </div>
        <div>
          <label className="label">Contrat d'achat à lier</label>
          <select className="input" value={contratId} onChange={e => setContratId(e.target.value)}>
            <option value="">— Aucun (départ silo) —</option>
            {contrats.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.numero_contrat} · {c.produit?.nom} · {c.fournisseur?.nom} ({c.famille})
              </option>
            ))}
          </select>
          {contratId && contratId !== vente.contrat_achat_id && (
            <p className="text-xs text-orange-600 mt-1">⚠️ Ce changement modifiera le lien de toutes les livraisons associées à ce contrat de vente.</p>
          )}
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Enregistrement...' : 'Enregistrer le lien'}</button>
        </div>
      </form>
    </Modal>
  )
}
