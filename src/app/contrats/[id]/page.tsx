'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, ArrowLeft, AlertTriangle, Plus, FileDown, Edit, CheckCircle, Pencil, Trash2, Link2Off, PackageOpen } from 'lucide-react'
import { BadgeFamille, BadgeStatut } from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'
import { formatDate, formatTonnes, formatEurosParTonne, formatEuros } from '@/lib/annee-agricole'
import { quantiteLivree, reliquat, ecartTransport } from '@/lib/utils'
import { useAdmin } from '@/components/ui/AdminProvider'
import Link from 'next/link'
import AjouterLivraisonModal from '@/components/livraisons/AjouterLivraisonModal'
import RealiserLivraisonModal from '@/components/livraisons/RealiserLivraisonModal'
import ModifierLivraisonModal from '@/components/livraisons/ModifierLivraisonModal'
import ModifierLivraisonRealiseeModal from '@/components/livraisons/ModifierLivraisonRealiseeModal'
import ModifierContratModal from '@/components/contrats/ModifierContratModal'
import ModifierVenteModal from '@/components/contrats/ModifierVenteModal'
import LierVenteModal from '@/components/contrats/LierVenteModal'
import NouvelleVenteModal from '@/components/contrats/NouvelleVenteModal'
import AffecterSiloModal from '@/components/contrats/AffecterSiloModal'
import { getPrefixes } from '@/lib/prefixes'
import SoldeOuvertureModal from '@/components/livraisons/SoldeOuvertureModal'

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
  const [modifierLivRealisee, setModifierLivRealisee] = useState<any>(null)
  const [showModifierContrat, setShowModifierContrat] = useState(false)
  const [modifierVente, setModifierVente] = useState<any>(null)
  const [showSoldeOuverture, setShowSoldeOuverture] = useState(false)
  const [showAffecterSilo, setShowAffecterSilo] = useState(false)
  const [modifierSilo, setModifierSilo] = useState<any>(null)

  async function chargerContrat() {
    const data = await fetch(`/api/contrats/${id}?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.json())
    setContrat(data)
    setLoading(false)
  }

  useEffect(() => { chargerContrat() }, [id])

  async function toggleStatut() {
    const nouveau = contrat.statut === 'en_cours' ? 'clos' : 'en_cours'
    await fetch(`/api/contrats/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: nouveau }),
    })
    window.location.reload()
  }

  async function supprimerContrat() {
    if (!confirm(`Supprimer le contrat ${contrat.numero_contrat} et TOUTES ses données (livraisons, contrats de vente, factures) ?\n\nCette action est irréversible.`)) return
    if (!confirm('Dernière confirmation — supprimer définitivement ?')) return
    const res = await fetch(`/api/contrats/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/contrats')
    } else {
      const d = await res.json()
      alert('Erreur : ' + (d.error ?? 'impossible de supprimer'))
    }
  }

  async function supprimerLivraison(livId: string) {
    if (!confirm('Supprimer cette livraison ?')) return
    await fetch(`/api/livraisons/${livId}`, { method: 'DELETE' })
    window.location.reload()
  }

  async function supprimerFactureFournisseur(factureId: string) {
    if (!confirm('Supprimer cette facture fournisseur ?')) return
    await fetch(`/api/factures/fournisseur/${factureId}`, { method: 'DELETE' })
    window.location.reload()
  }

  async function toggleTransporteurContacte(livId: string, current: boolean) {
    await fetch(`/api/livraisons/${livId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transporteur_contacte: !current }),
    })
    window.location.reload()
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
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowModifierContrat(true)} className="btn-secondary">
              <Edit size={15} /> Modifier
            </button>
            {contrat.statut === 'en_cours' && !contrat.gere_par_silo && (
              <button
                onClick={() => setShowSoldeOuverture(true)}
                className="btn-secondary text-sm"
                title="Migration depuis Google Sheet — saisir le tonnage déjà livré avant l'utilisation de ce logiciel"
              >
                <PackageOpen size={15} /> Solde d'ouverture
              </button>
            )}
            <button onClick={toggleStatut} className={contrat.statut === 'en_cours' ? 'btn-primary' : 'btn-secondary'}>
              <CheckCircle size={16} />
              {contrat.statut === 'en_cours' ? 'Clôturer' : 'Rouvrir'}
            </button>
            <button onClick={supprimerContrat} className="btn-danger">
              <Trash2 size={15} /> Supprimer
            </button>
          </div>
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
              ...(contrat.famille === 'negoce' && contrat.base_prix ? [['Base prix', contrat.base_prix.replace('juillet_', 'Base Juillet ')]] : []),
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-gray-500 font-medium">{label}</dt>
                <dd className="text-gray-900 mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
          {contrat.famille === 'negoce' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${contrat.mbm_autorise ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
                <span className={`w-2 h-2 rounded-full ${contrat.mbm_autorise ? 'bg-green-500' : 'bg-gray-400'}`} />
                MBM {contrat.mbm_autorise ? 'autorisées' : 'non autorisées'}
              </span>
            </div>
          )}
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
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Contrat total</div>
            <div className="text-3xl font-extrabold text-gray-900">{formatTonnes(contrat.quantite_totale)}</div>
            <div className="mt-2 text-sm text-gray-500">dont <span className="font-semibold text-gray-700">{formatTonnes(livre)}</span> livrées</div>
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
              <button onClick={() => setShowAffecterSilo(true)} className="btn-secondary text-xs text-amber-700 border-amber-200 hover:bg-amber-50">
                <Plus size={14} /> Silo
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
                {['N° Contrat', 'Agriculteur', 'Produit', 'Quantité', 'Prix vente', 'Début', 'Fin', 'Statut', 'Facture client', ''].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(contrat.contrats_vente ?? []).length === 0 && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400 text-sm">Aucun contrat de vente lié</td></tr>
              )}
              {(contrat.contrats_vente ?? []).map((cv: any) => {
                if (cv.destination_silo) {
                  return (
                    <tr key={cv.id} className="table-row bg-amber-50/40">
                      <td className="table-cell">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-semibold">
                          🏚 {cv.silo_nom}
                        </span>
                      </td>
                      <td className="table-cell text-gray-400 text-xs italic">Stock propre</td>
                      <td className="table-cell">{cv.produit?.nom ?? '—'}</td>
                      <td className="table-cell font-semibold">{formatTonnes(cv.quantite)}</td>
                      <td className="table-cell text-gray-300">—</td>
                      <td className="table-cell text-gray-300">—</td>
                      <td className="table-cell text-gray-300">—</td>
                      <td className="table-cell">
                        <span className="badge-appro text-xs">Silo</span>
                      </td>
                      <td className="table-cell text-xs text-gray-400 italic">Pas de facturation</td>
                      {isAdmin && (
                        <td className="table-cell">
                          <div className="flex gap-1">
                            <button onClick={() => setModifierSilo(cv)} className="btn-secondary text-xs py-1 px-2" title="Modifier">
                              <Pencil size={12} />
                            </button>
                            <button onClick={async () => {
                              if (!confirm(`Supprimer l'affectation silo "${cv.silo_nom}" (${cv.quantite} t) ?`)) return
                              await fetch(`/api/ventes/${cv.id}`, { method: 'DELETE' })
                              window.location.reload()
                            }} className="btn-danger text-xs py-1 px-2" title="Supprimer">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                }
                return (
                <tr key={cv.id} className="table-row">
                  <td className="table-cell font-medium text-green-700">{cv.numero_contrat}</td>
                  <td className="table-cell">{cv.agriculteur?.nom ?? '—'}</td>
                  <td className="table-cell">{cv.produit?.nom ?? '—'}</td>
                  <td className="table-cell font-semibold">{formatTonnes(cv.quantite)}</td>
                  <td className="table-cell">{formatEurosParTonne(cv.prix_vente)}</td>
                  <td className="table-cell text-sm">{cv.date_debut ? formatDate(cv.date_debut) : <span className="text-gray-300">—</span>}</td>
                  <td className="table-cell text-sm">{cv.date_fin ? formatDate(cv.date_fin) : <span className="text-gray-300">—</span>}</td>
                  <td className="table-cell"><BadgeStatut statut={cv.statut} /></td>
                  <td className="table-cell text-xs">
                    {cv.factures_client?.length > 0
                      ? cv.factures_client.map((f: any) => f.numero_facture_atys ?? f.numero_facture).join(', ')
                      : (() => {
                          const livsCv = (contrat.livraisons ?? []).filter((l: any) => l.contrat_vente_id === cv.id)
                          if (livsCv.length === 0) return <span className="text-gray-400">—</span>
                          const toutesRealisees = livsCv.every((l: any) => l.type === 'realisee')
                          if (!toutesRealisees) return <span className="text-gray-400">En attente fin de livraisons</span>
                          const derniere = livsCv.map((l: any) => l.date_reelle).filter(Boolean).sort().at(-1)
                          if (!derniere) return <span className="text-gray-400">—</span>
                          const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                          if (derniere > cutoff) {
                            const dispo = new Date(new Date(derniere).getTime() + 30 * 24 * 60 * 60 * 1000)
                            return <span className="text-gray-400">Disponible le {dispo.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
                          }
                          return <span className="text-orange-500 font-medium">⚠️ À récupérer dans Atys</span>
                        })()
                    }
                  </td>
                  {isAdmin && (
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button onClick={() => setModifierVente(cv)} className="btn-secondary text-xs py-1 px-2" title="Modifier">
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Délier "${cv.numero_contrat}" de ce contrat d'achat ?\nLe contrat de vente sera conservé mais sans contrat d'achat associé.`)) return
                            await fetch(`/api/ventes/${cv.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ contrat_achat_id: null }),
                            })
                            window.location.reload()
                          }}
                          className="btn-secondary text-xs py-1 px-2 text-orange-600 hover:bg-orange-50"
                          title="Délier ce contrat de vente"
                        >
                          <Link2Off size={12} />
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`Supprimer le contrat de vente ${cv.numero_contrat} ?`)) return
                          await fetch(`/api/ventes/${cv.id}`, { method: 'DELETE' })
                          window.location.reload()
                        }} className="btn-danger text-xs py-1 px-2" title="Supprimer">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
                )
              })}
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
          <div className="border-t-4 border-green-200">
            <div className="px-5 py-2.5 bg-green-600 text-xs font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-white/70" />
              Réalisées ({livraisonsRealisees.length})
            </div>
            <div className="overflow-x-auto bg-green-50/30">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-green-100 bg-green-50/60">
                    {['Date réelle', 'Destinataire', 'Tonnes réelles', 'Ville enlèv.', 'Ville dest.', 'CMR', 'Pièce fourn.', 'Pièce client', 'Transport prévu', 'Transport réel', 'Écart', 'Facturé', ''].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {livraisonsRealisees.map((l: any) => {
                    const ecart = ecartTransport(l.montant_transport_reel, l.quantite_reelle, contrat.prix_transport_prevu)
                    const prevu = l.quantite_reelle != null ? l.quantite_reelle * contrat.prix_transport_prevu : null
                    return (
                      <tr key={l.id} className="table-row bg-green-50/40 hover:bg-green-50/80">
                        <td className="table-cell font-medium">{formatDate(l.date_reelle)}</td>
                        <td className="table-cell text-xs">
                          {(() => {
                            const cv = (contrat.contrats_vente ?? []).find((v: any) => v.id === l.contrat_vente_id)
                            if (!cv) return <span className="text-gray-400">—</span>
                            if (cv.destination_silo) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">🏚 {cv.silo_nom}</span>
                            return <span className="text-green-700 font-medium">{cv.agriculteur?.nom ?? '—'}</span>
                          })()}
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
                        <td className="table-cell">
                          {isAdmin && (
                            <button onClick={() => setModifierLivRealisee(l)} className="btn-secondary text-xs py-1 px-2">
                              <Pencil size={11} />
                            </button>
                          )}
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

      {/* Bilan financier */}
      {(() => {
        const coutFournisseur = (contrat.factures_fournisseur ?? []).reduce((s: number, f: any) => s + (f.montant_ht ?? 0), 0)
        const coutTransport = (contrat.livraisons ?? []).filter((l: any) => l.type === 'realisee').reduce((s: number, l: any) => s + (l.montant_transport_reel ?? 0), 0)
        const caClient = (contrat.contrats_vente ?? []).flatMap((cv: any) => cv.factures_client ?? []).reduce((s: number, f: any) => s + (f.montant_ht ?? 0), 0)
        const marge = caClient - coutFournisseur - coutTransport
        const margePct = caClient > 0 ? (marge / caClient) * 100 : null
        const tonnesRealisees = (contrat.livraisons ?? []).filter((l: any) => l.type === 'realisee').reduce((s: number, l: any) => s + (l.quantite_reelle ?? 0), 0)
        const margeParTonne = tonnesRealisees > 0 ? marge / tonnesRealisees : null
        const hasData = coutFournisseur > 0 || coutTransport > 0 || caClient > 0
        if (!hasData) return null
        return (
          <div className="card">
            <h2 className="font-bold text-gray-800 text-base mb-4">Bilan financier réel</h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                <p className="text-xs text-green-600 font-medium mb-1">CA client</p>
                <p className="text-lg font-bold text-green-700">{caClient > 0 ? formatEuros(caClient) : <span className="text-gray-300 text-sm">Non facturé</span>}</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                <p className="text-xs text-red-600 font-medium mb-1">Coût fournisseur</p>
                <p className="text-lg font-bold text-red-700">{coutFournisseur > 0 ? formatEuros(coutFournisseur) : <span className="text-gray-300 text-sm">—</span>}</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                <p className="text-xs text-amber-600 font-medium mb-1">Coût transport</p>
                <p className="text-lg font-bold text-amber-700">{coutTransport > 0 ? formatEuros(coutTransport) : <span className="text-gray-300 text-sm">—</span>}</p>
              </div>
              <div className={`border rounded-xl p-3 text-center ${caClient === 0 ? 'bg-gray-50 border-gray-100' : marge >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-xs font-medium mb-1 ${caClient === 0 ? 'text-gray-400' : marge >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Marge nette</p>
                <p className={`text-lg font-bold ${caClient === 0 ? 'text-gray-300' : marge >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                  {caClient > 0 ? formatEuros(marge) : '—'}
                </p>
                {margePct !== null && caClient > 0 && (
                  <p className={`text-xs font-semibold mt-0.5 ${marge >= 0 ? 'text-blue-500' : 'text-red-500'}`}>{margePct.toFixed(1)} %</p>
                )}
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                <p className="text-xs text-purple-600 font-medium mb-1">Marge / tonne</p>
                <p className="text-lg font-bold text-purple-700">
                  {margeParTonne !== null && caClient > 0 ? formatEurosParTonne(margeParTonne) : <span className="text-gray-300 text-sm">—</span>}
                </p>
              </div>
            </div>
            {caClient === 0 && (coutFournisseur > 0 || coutTransport > 0) && (
              <p className="text-xs text-amber-600 mt-3">⚠️ Aucune facture client saisie — la marge ne peut pas être calculée.</p>
            )}
          </div>
        )
      })()}

      {/* Factures fournisseur */}
      <div className="card-section">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Factures fournisseur</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['N° Facture', 'N° Pièce Atys', 'Montant HT', 'Montant TTC', 'Mode paiement', 'Date paiement', ''].map(h => (
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
                  <td className="table-cell">
                    {isAdmin && (
                      <button onClick={() => supprimerFactureFournisseur(f.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded" title="Supprimer cette facture">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
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
          onSaved={() => { setShowAjoutLiv(false); window.location.reload() }}
        />
      )}
      {realiserLiv && (
        <RealiserLivraisonModal
          livraison={realiserLiv}
          contrat={contrat}
          onClose={() => setRealiserLiv(null)}
          onSaved={() => { setRealiserLiv(null); window.location.reload() }}
        />
      )}
      {modifierLiv && (
        <ModifierLivraisonModal
          livraison={modifierLiv}
          contrat={contrat}
          onClose={() => setModifierLiv(null)}
          onSaved={() => { setModifierLiv(null); window.location.reload() }}
        />
      )}
      {modifierLivRealisee && (
        <ModifierLivraisonRealiseeModal
          livraison={modifierLivRealisee}
          contrat={contrat}
          onClose={() => setModifierLivRealisee(null)}
          onSaved={() => { setModifierLivRealisee(null); window.location.reload() }}
        />
      )}
      {modifierVente && (
        <ModifierVenteModal
          vente={modifierVente}
          contrat={contrat}
          onClose={() => setModifierVente(null)}
          onSaved={() => { setModifierVente(null); window.location.reload() }}
        />
      )}
      {showModifierContrat && (
        <ModifierContratModal
          contrat={contrat}
          onClose={() => setShowModifierContrat(false)}
          onSaved={() => { setShowModifierContrat(false); window.location.reload() }}
        />
      )}
      {showLierVente && (
        <LierVenteModal
          contratAchatId={id}
          onClose={() => setShowLierVente(false)}
          onSaved={() => { setShowLierVente(false); window.location.reload() }}
        />
      )}
      {showNouvelleVente && (
        <NouvelleVenteModal
          contrat={contrat}
          onClose={() => setShowNouvelleVente(false)}
          onSaved={() => { setShowNouvelleVente(false); window.location.reload() }}
        />
      )}
      {(showAffecterSilo || modifierSilo) && (
        <AffecterSiloModal
          contrat={contrat}
          siloExistant={modifierSilo ?? undefined}
          onClose={() => { setShowAffecterSilo(false); setModifierSilo(null) }}
          onSaved={() => { setShowAffecterSilo(false); setModifierSilo(null); window.location.reload() }}
        />
      )}
      {showSoldeOuverture && (
        <SoldeOuvertureModal
          contratId={id}
          contratNumero={contrat.numero_contrat}
          quantiteTotale={contrat.quantite_totale ?? 0}
          quantiteDejaLivree={quantiteLivree(contrat.livraisons ?? [])}
          onClose={() => setShowSoldeOuverture(false)}
          onSaved={() => { setShowSoldeOuverture(false); chargerContrat() }}
        />
      )}
    </div>
  )
}
