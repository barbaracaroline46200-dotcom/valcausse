'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { FileWarning, Loader2, Trash2 } from 'lucide-react'
import RealiserLivraisonModal from '@/components/livraisons/RealiserLivraisonModal'
import { useAdmin } from '@/components/ui/AdminProvider'
import { formatDate } from '@/lib/annee-agricole'
import { joursDepuis, contratSyntheticFromVente } from '@/lib/utils'

export default function CmrPage() {
  const { isAdmin } = useAdmin()
  const pathname = usePathname()
  const [cmr, setCmr] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [cmrModal, setCmrModal] = useState<any>(null)
  const [filtTransporteur, setFiltTransporteur] = useState('')
  const [filtFournisseur, setFiltFournisseur] = useState('')
  const [filtProduit, setFiltProduit] = useState('')
  const [filtAgriculteur, setFiltAgriculteur] = useState('')

  const reload = useCallback(async () => {
    const res = await fetch('/api/dashboard')
    const d = await res.json()
    setCmr(d.cmrEnAttente ?? [])
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

  const [onglet, setOnglet] = useState<'normal' | 'negoce_silo' | 'appro_gare'>('normal')

  // Vente pertinente pour une livraison : lien direct (contrat_vente_id) si présent,
  // sinon la vente "vente départ silo" sans contrat d'achat. Jamais une vente au hasard
  // du même contrat d'achat (ex. un vrai agriculteur, ou une vente "silo" mal nommée) —
  // a déjà produit un faux positif (CA.0401326, cf. commit sur ce fichier).
  function getCv(l: any) {
    const exact = l.contrat_achat?.contrats_vente?.find((cv: any) => cv.id === l.contrat_vente_id)
    if (exact) return exact
    if (l.contrat_vente) return l.contrat_vente
    return undefined
  }

  function getAgri(l: any) {
    return getCv(l)?.agriculteur
  }

  function categorise(l: any): 'normal' | 'negoce_silo' | 'appro_gare' {
    const cv = getCv(l)
    const estSilo = l.destination_silo || cv?.destination_silo
    if (!estSilo) return 'normal'
    // Pas de vente liée pour préciser le silo : par convention, appro = silo gare
    // (CMR requis), négoce = silo simple (BA seulement) — cf. RealiserLivraisonModal.
    const gare = cv?.silo_nom ? cv.silo_nom.toLowerCase().includes('gare') : l.contrat_achat?.famille === 'appro'
    return gare ? 'appro_gare' : 'negoce_silo'
  }

  const cmrNormal     = useMemo(() => cmr.filter(l => categorise(l) === 'normal'),      [cmr])
  const cmrNegoSilo   = useMemo(() => cmr.filter(l => categorise(l) === 'negoce_silo'), [cmr])
  const cmrApproGare  = useMemo(() => cmr.filter(l => categorise(l) === 'appro_gare'),  [cmr])

  const listeActive = onglet === 'normal' ? cmrNormal : onglet === 'negoce_silo' ? cmrNegoSilo : cmrApproGare

  const transporteurs = useMemo(() => [...new Set(listeActive.map((l: any) => l.transporteur?.nom ?? l.contrat_achat?.transporteur?.nom).filter(Boolean))].sort(), [listeActive])
  const fournisseurs  = useMemo(() => [...new Set(listeActive.map((l: any) => l.contrat_achat?.fournisseur?.nom).filter(Boolean))].sort(), [listeActive])
  const produits      = useMemo(() => [...new Set(listeActive.map((l: any) => l.contrat_achat?.produit?.nom ?? l.contrat_vente?.produit?.nom).filter(Boolean))].sort(), [listeActive])
  const agriculteurs  = useMemo(() => [...new Set(listeActive.map((l: any) => getAgri(l)?.nom).filter(Boolean))].sort(), [listeActive])

  const cmrFiltres = useMemo(() => listeActive.filter((l: any) => {
    if (filtTransporteur && (l.transporteur?.nom ?? l.contrat_achat?.transporteur?.nom) !== filtTransporteur) return false
    if (filtFournisseur  && l.contrat_achat?.fournisseur?.nom  !== filtFournisseur)  return false
    if (filtProduit      && (l.contrat_achat?.produit?.nom ?? l.contrat_vente?.produit?.nom) !== filtProduit) return false
    if (filtAgriculteur  && (getAgri(l)?.nom ?? '—')           !== filtAgriculteur)  return false
    return true
  }), [listeActive, filtTransporteur, filtFournisseur, filtProduit, filtAgriculteur])

  const hasFiltres = filtTransporteur || filtFournisseur || filtProduit || filtAgriculteur

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-green-600" size={32} />
    </div>
  )

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#dc2626' }}>
            <FileWarning size={22} />
            CMR en attente
            {cmr.length > 0 && (
              <span className="ml-2 min-w-[24px] h-6 px-2 rounded-full text-white text-sm font-bold flex items-center justify-center bg-red-600">
                {hasFiltres ? `${cmrFiltres.length}/${cmr.length}` : cmr.length}
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Cliquer sur une ligne pour saisir le CMR / BA</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'normal',      label: 'Livraisons',        count: cmrNormal.length,    color: '#dc2626', desc: 'CMR manquant' },
          { key: 'negoce_silo', label: 'Silo Négoce',       count: cmrNegoSilo.length,  color: '#7B2820', desc: 'BA manquant' },
          { key: 'appro_gare',  label: 'Silo gare Appro',   count: cmrApproGare.length, color: '#d97706', desc: 'CMR manquant' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setOnglet(tab.key); setFiltTransporteur(''); setFiltFournisseur(''); setFiltProduit(''); setFiltAgriculteur('') }}
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

      {/* Filtres + description */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-gray-400">
          {onglet === 'normal' && 'Livraisons classiques — N° CMR (lettre de voiture) manquant'}
          {onglet === 'negoce_silo' && 'Négoce vers silo — BA (pièce fournisseur) manquant, pas de CMR'}
          {onglet === 'appro_gare' && 'Appro vers silo gare — N° CMR manquant'}
        </p>
        {listeActive.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <select value={filtTransporteur} onChange={e => setFiltTransporteur(e.target.value)} className="input text-sm py-1.5 w-40">
              <option value="">Tous transporteurs</option>
              {(transporteurs as string[]).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
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
              <button onClick={() => { setFiltTransporteur(''); setFiltFournisseur(''); setFiltProduit(''); setFiltAgriculteur('') }}
                className="text-xs text-gray-400 hover:text-gray-600 underline">Effacer</button>
            )}
          </div>
        )}
      </div>

      <div className="card-section overflow-hidden">
        {listeActive.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-500 text-sm">Aucune entrée dans cette catégorie 🎉</div>
        ) : cmrFiltres.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">Aucun résultat pour ces filtres</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Contrat', 'Fournisseur', 'Produit', 'Agriculteur', 'Transporteur', 'Date livraison', 'Contact', 'Délai', '', ''].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cmrFiltres.map((l: any) => {
                const isRealisee = l.type === 'realisee'
                // Une planifiée peut n'avoir qu'un mois connu (mois_prevu), sans date précise —
                // sans repli, joursDepuis(null) plantait sur l'epoch Unix (~20700j de "retard").
                const dateRef = isRealisee ? l.date_reelle : (l.date_prevue || l.date_souhaitee || l.mois_prevu)
                const jours = joursDepuis(dateRef)
                const dateAffichee = isRealisee
                  ? formatDate(l.date_reelle)
                  : l.date_prevue ? formatDate(l.date_prevue) : (l.semaine_prevue ?? '—')
                const agri = getAgri(l)
                return (
                  <tr key={l.id}
                    className={`table-row cursor-pointer hover:bg-red-50 transition-colors ${!isRealisee ? 'bg-amber-50/40' : ''}`}
                    onClick={() => setCmrModal(l)}
                    title="Cliquer pour saisir le CMR">
                    <td className="table-cell">
                      {l.contrat_achat
                        ? <a href={`/contrats/${l.contrat_achat.id}`} className="text-green-700 hover:underline text-sm font-medium" onClick={e => e.stopPropagation()}>
                            {l.contrat_achat.numero_contrat ?? '—'}
                          </a>
                        : l.contrat_vente
                          ? <a href={`/ventes/${l.contrat_vente.id}`} className="text-green-700 hover:underline text-sm font-medium" onClick={e => e.stopPropagation()}>
                              {l.contrat_vente.numero_contrat ?? '—'}
                            </a>
                          : '—'}
                    </td>
                    <td className="table-cell text-sm">{l.contrat_achat?.fournisseur?.nom ?? (l.contrat_vente ? 'Vente directe (silo)' : '—')}</td>
                    <td className="table-cell font-medium">{l.contrat_achat?.produit?.nom ?? l.contrat_vente?.produit?.nom ?? '—'}</td>
                    <td className="table-cell text-sm">{[agri?.civilite, agri?.nom].filter(Boolean).join(' ') || '—'}</td>
                    <td className="table-cell">{l.transporteur?.nom ?? l.contrat_achat?.transporteur?.nom ?? '—'}</td>
                    <td className="table-cell">
                      <span className={!isRealisee ? 'text-amber-700 font-medium' : ''}>{dateAffichee}</span>
                      {!isRealisee && <span className="ml-1 text-xs text-amber-600">(prévue)</span>}
                    </td>
                    <td className="table-cell text-sm">
                      {(l.transporteur?.telephone ?? l.contrat_achat?.transporteur?.telephone) && (
                        <span className="text-gray-600">📞 {l.transporteur?.telephone ?? l.contrat_achat?.transporteur?.telephone}</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {jours != null ? <span className="badge-alerte">{jours}j</span> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="table-cell">
                      {isRealisee
                        ? <span className="text-xs text-orange-600 font-medium underline">{onglet === 'negoce_silo' ? 'N° BA manquant →' : 'N° CMR manquant →'}</span>
                        : <span className="text-xs text-red-600 font-medium underline">Saisir CMR →</span>
                      }
                    </td>
                    {isAdmin && (
                      <td className="table-cell" onClick={e => e.stopPropagation()}>
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


      {cmrModal && (
        <RealiserLivraisonModal
          livraison={cmrModal}
          contrat={cmrModal.contrat_achat ?? contratSyntheticFromVente(cmrModal.contrat_vente)}
          onClose={() => setCmrModal(null)}
          onSaved={() => { setCmrModal(null); reload() }}
        />
      )}
    </div>
  )
}
