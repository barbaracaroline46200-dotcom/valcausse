'use client'
// v2
import { getDashboardData } from './actions'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Phone, AlertTriangle, TrendingUp, Loader2, Plus, Trash2, CheckSquare, Square, CalendarDays, CheckCircle2, Circle, ClipboardList, CheckCircle, Wheat, Sprout, PackageOpen } from 'lucide-react'
import { formatDate, formatTonnes, getAnneeAgricoleLabel, getAnneeAgricole } from '@/lib/annee-agricole'
import { quantiteLivree, reliquat } from '@/lib/utils'
import CalendrierLivraisons from '@/components/ui/CalendrierLivraisons'
import { useAdmin } from '@/components/ui/AdminProvider'
import Link from 'next/link'
import NouveauContratModal from '@/components/contrats/NouveauContratModal'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DashboardPage() {
  const { isAdmin } = useAdmin()
  const pathname = usePathname()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTransporteur, setSelectedTransporteur] = useState('')
  const [selectedMois, setSelectedMois] = useState('')
  const [transporteurs, setTransporteurs] = useState<any[]>([])
  const [livraisonsTransporteur, setLivraisonsTransporteur] = useState<any[]>([])
  const [agendaToday, setAgendaToday] = useState<any[]>([])
  const [toast, setToast] = useState('')
  const [filtAnnee, setFiltAnnee] = useState<string>(() => getAnneeAgricoleLabel())
  const [showNouveauContrat, setShowNouveauContrat] = useState(false)
  const [filtTpStatut, setFiltTpStatut] = useState('')
  const [filtTpFournisseur, setFiltTpFournisseur] = useState('')
  const [filtTpProduit, setFiltTpProduit] = useState('')
  const [filtTpAgriculteur, setFiltTpAgriculteur] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const reloadData = useCallback(async () => {
    const d = await getDashboardData()
    setData(d)
    setTransporteurs((d as any).transporteurs ?? [])
    setLoading(false)
    fetch(`/api/agenda?lte=${todayStr()}&non_fait=1`).then(r => r.json()).then(d => setAgendaToday(Array.isArray(d) ? d : []))
  }, [])

  // Chargement initial
  useEffect(() => {
    const now = new Date()
    setSelectedMois(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    reloadData()
  }, [])

  // Rechargement à chaque fois qu'on revient sur le dashboard (navigation SPA)
  useEffect(() => {
    if (!loading) reloadData()
  }, [pathname])

  // Rechargement si l'onglet redevient visible
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') reloadData()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    if (!selectedTransporteur) return
    fetch(`/api/livraisons?transporteur_id=${selectedTransporteur}&mois=${selectedMois}-01`)
      .then(r => r.json())
      .then(setLivraisonsTransporteur)
  }, [selectedTransporteur, selectedMois])

  function recharger() {
    window.location.reload()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-green-600" size={32} />
    </div>
  )

  // Calculs statistiques année agricole
  const allContrats = data?.contrats ?? []

  // Années agricoles disponibles (format "2024/2025")
  function anneeLabel(dateStr?: string | null): string | null {
    if (!dateStr) return null
    return getAnneeAgricoleLabel(new Date(dateStr))
  }
  const anneesDisponibles = [...new Set(
    allContrats.map((c: any) => anneeLabel(c.date_debut)).filter(Boolean)
  )].sort().reverse() as string[]
  if (!anneesDisponibles.includes(getAnneeAgricoleLabel())) {
    anneesDisponibles.unshift(getAnneeAgricoleLabel())
  }

  // Filtrage par année
  const contrats = filtAnnee
    ? allContrats.filter((c: any) => {
        if (!c.date_debut) return false
        return getAnneeAgricoleLabel(new Date(c.date_debut)) === filtAnnee
      })
    : allContrats

  const parFamille = { appro: { total: 0, livre: 0, contrats: 0 }, negoce: { total: 0, livre: 0, contrats: 0 } }
  const parProduit: Record<string, number> = {}

  contrats.forEach((c: any) => {
    const f = c.famille as 'appro' | 'negoce'
    // Contrats gérés par le silo : tout le tonnage est considéré comme livré
    const livre = c.gere_par_silo ? c.quantite_totale : quantiteLivree(c.livraisons ?? [])
    parFamille[f].total += c.quantite_totale
    parFamille[f].livre += livre
    parFamille[f].contrats++
    const nom = c.produit?.nom ?? 'Inconnu'
    parProduit[nom] = (parProduit[nom] ?? 0) + livre
  })

  const chartData = Object.entries(parProduit)
    .sort((a, b) => b[1] - a[1])
    .map(([nom, val]) => ({ nom, tonnes: Math.round(val * 10) / 10 }))

  const contratsEnCours = contrats.filter((c: any) => c.statut === 'en_cours').length
  const contratsClos = contrats.filter((c: any) => c.statut === 'clos').length

  const alertes = (data?.contratsAlerte ?? []).filter((c: any) => !c.gere_par_silo && reliquat(c.quantite_totale, c.livraisons ?? []) > 0)

  return (
    <>
    {toast && (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-semibold flex items-center gap-2 animate-fade-in" style={{ backgroundColor: '#15803d' }}>
        ✓ {toast}
      </div>
    )}
    <div className="space-y-8 pb-10">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#7B2820' }}>Tableau de bord</h1>
          <p className="text-gray-500 text-sm mt-0.5">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button onClick={() => setShowNouveauContrat(true)} className="btn-primary">
              <Plus size={16} /> Nouveau contrat
            </button>
          )}
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Année agricole</span>
          <select
            value={filtAnnee}
            onChange={e => setFiltAnnee(e.target.value)}
            className="input w-32 text-sm font-semibold py-1.5"
            style={{ color: '#7B2820', borderColor: '#e4b5ad' }}
          >
            {anneesDisponibles.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bloc Agenda du jour — admin uniquement */}
      {isAdmin && (agendaToday.length > 0) && (
        <div className="rounded-xl border-2 p-4" style={{ borderColor: '#C8941A', backgroundColor: '#fffdf5' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} style={{ color: '#C8941A' }} />
              <span className="font-bold text-sm" style={{ color: '#7B2820' }}>
                À faire — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
            <Link href="/agenda" className="text-xs font-medium hover:underline" style={{ color: '#C8941A' }}>
              Voir l'agenda →
            </Link>
          </div>
          <div className="space-y-2">
            {agendaToday.map((note: any) => (
              <div key={note.id} className="flex items-start gap-2.5">
                <button
                  onClick={async () => {
                    await fetch(`/api/agenda/${note.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ fait: !note.fait }),
                    })
                    fetch(`/api/agenda?lte=${todayStr()}&non_fait=1`).then(r => r.json()).then(d => setAgendaToday(Array.isArray(d) ? d : []))
                  }}
                  className="mt-0.5 flex-shrink-0"
                >
                  {note.fait
                    ? <CheckCircle2 size={18} className="text-green-500" />
                    : <Circle size={18} style={{ color: '#C8941A' }} />
                  }
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-semibold ${note.fait ? 'line-through text-gray-400' : 'text-gray-800'}`}>{note.titre}</p>
                    {note.date_note !== todayStr() && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium flex-shrink-0">
                        {formatDate(note.date_note)}
                      </span>
                    )}
                  </div>
                  {note.contenu && <p className={`text-xs mt-0.5 ${note.fait ? 'text-gray-300' : 'text-gray-500'}`}>{note.contenu}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Résumé année — cartes horizontales style mockup */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { label: 'Contrats en cours', value: contratsEnCours,                     sub: 'campagne active',      Icon: ClipboardList, iconBg: '#fff3d0', iconColor: '#a37514' },
          { label: 'Contrats clos',     value: contratsClos,                         sub: 'soldés cette année',   Icon: CheckCircle,   iconBg: '#dcfce7', iconColor: '#15803d' },
          { label: 'Négoce livré',      value: formatTonnes(parFamille.negoce.livre), sub: 'cumul année agricole', Icon: Wheat,         iconBg: '#fde8e5', iconColor: '#7B2820' },
          { label: 'Appro livré',       value: formatTonnes(parFamille.appro.livre),  sub: 'cumul année agricole', Icon: Sprout,        iconBg: '#dbeafe', iconColor: '#2a5570' },
        ] as any[]).map(item => (
          <div key={item.label} className="card flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.iconBg }}>
              <item.Icon size={22} style={{ color: item.iconColor }} />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-gray-900 leading-tight">{item.value}</div>
              <div className="text-xs font-semibold text-gray-600 leading-tight mt-0.5">{item.label}</div>
              <div className="text-[11px] text-gray-400 leading-tight">{item.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Graphique par produit — barres CSS style mockup */}
      {chartData.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#fff3d0' }}>
              <TrendingUp size={18} style={{ color: '#a37514' }} />
            </div>
            <div>
              <h2 className="font-bold text-gray-800">Tonnage livré par produit</h2>
              <p className="text-xs text-gray-400">Année agricole {filtAnnee}</p>
            </div>
          </div>
          {(() => {
            const max = Math.max(...chartData.map(d => d.tonnes))
            const BAR_COLORS = ['#7B2820','#C8941A','#7B2820','#C8941A','#7B2820','#C8941A','#7B2820','#C8941A']
            return (
              <div className="space-y-3">
                {chartData.map((d, i) => (
                  <div key={d.nom} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-28 flex-shrink-0 text-right">{d.nom}</span>
                    <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ backgroundColor: '#f3f0ee' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(d.tonnes / max) * 100}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-20 flex-shrink-0">
                      {d.tonnes.toLocaleString('fr-FR')} t
                    </span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Calendrier des livraisons */}
      <CalendrierLivraisons />

      {/* ── Onglets Suivi livraisons supprimés — voir menu latéral ── */}

      {/* Section Point transporteur */}
      {(() => {
        const tpFournisseurs = [...new Set(livraisonsTransporteur.map((l: any) => l.contrat_achat?.fournisseur?.nom).filter(Boolean))].sort()
        const tpProduits = [...new Set(livraisonsTransporteur.map((l: any) => l.contrat_achat?.produit?.nom).filter(Boolean))].sort()
        const tpAgriculteurs = [...new Set(livraisonsTransporteur.map((l: any) => {
          const cv = (l.contrat_achat?.contrats_vente ?? []).find((cv: any) => cv.id === l.contrat_vente_id)
          return cv?.destination_silo ? (cv.silo_nom ?? 'Silo') : cv?.agriculteur?.nom
        }).filter(Boolean))].sort()

        const livraisonsFiltrees = livraisonsTransporteur.filter((l: any) => {
          if (filtTpStatut) {
            const isRealisee = l.type === 'realisee'
            if (filtTpStatut === 'realisee' && !isRealisee) return false
            if (filtTpStatut === 'planifiee' && isRealisee) return false
          }
          if (filtTpFournisseur && l.contrat_achat?.fournisseur?.nom !== filtTpFournisseur) return false
          if (filtTpProduit && l.contrat_achat?.produit?.nom !== filtTpProduit) return false
          if (filtTpAgriculteur) {
            const cv = (l.contrat_achat?.contrats_vente ?? []).find((cv: any) => cv.id === l.contrat_vente_id)
            const nom = cv?.destination_silo ? (cv.silo_nom ?? 'Silo') : cv?.agriculteur?.nom
            if (nom !== filtTpAgriculteur) return false
          }
          return true
        })

        return (
        <Section
          icon={<Phone size={20} />}
          title="Point transporteur"
          count={null}
          color="orange"
          subtitle="Outil d'appel — sélectionnez un transporteur et un mois"
        >
          <div className="flex gap-2 mb-3 flex-wrap items-center">
            <select value={selectedTransporteur} onChange={e => setSelectedTransporteur(e.target.value)} className="input max-w-xs">
              <option value="">Choisir un transporteur...</option>
              {transporteurs.map((t: any) => (
                <option key={t.id} value={t.id}>{t.nom}</option>
              ))}
            </select>
            <input type="month" value={selectedMois} onChange={e => setSelectedMois(e.target.value)} className="input w-40" />
            {selectedTransporteur && (() => {
              const t = transporteurs.find((t: any) => t.id === selectedTransporteur)
              return t?.telephone ? (
                <a href={`tel:${t.telephone}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#C8941A' }}>
                  📞 {t.telephone}
                </a>
              ) : null
            })()}
          </div>
          {livraisonsTransporteur.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap px-0 pb-2 border-b border-gray-100">
              <select value={filtTpStatut} onChange={e => setFiltTpStatut(e.target.value)} className="input text-sm py-1.5 w-36">
                <option value="">Tous statuts</option>
                <option value="planifiee">Planifiées</option>
                <option value="realisee">Réalisées</option>
              </select>
              <select value={filtTpFournisseur} onChange={e => setFiltTpFournisseur(e.target.value)} className="input text-sm py-1.5 w-40">
                <option value="">Tous fournisseurs</option>
                {tpFournisseurs.map((f: any) => <option key={f} value={f}>{f}</option>)}
              </select>
              <select value={filtTpProduit} onChange={e => setFiltTpProduit(e.target.value)} className="input text-sm py-1.5 w-40">
                <option value="">Tous produits</option>
                {tpProduits.map((p: any) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filtTpAgriculteur} onChange={e => setFiltTpAgriculteur(e.target.value)} className="input text-sm py-1.5 w-48">
                <option value="">Tous agriculteurs</option>
                {tpAgriculteurs.map((a: any) => <option key={a} value={a}>{a}</option>)}
              </select>
              {(filtTpStatut || filtTpFournisseur || filtTpProduit || filtTpAgriculteur) && (
                <button onClick={() => { setFiltTpStatut(''); setFiltTpFournisseur(''); setFiltTpProduit(''); setFiltTpAgriculteur('') }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline px-2">
                  Effacer filtres
                </button>
              )}
              <span className="text-xs text-gray-400 self-center ml-1">{livraisonsFiltrees.length} / {livraisonsTransporteur.length}</span>
            </div>
          )}
          {selectedTransporteur && livraisonsTransporteur.length === 0 && (
            <EmptyState text="Aucune livraison pour ce transporteur ce mois-ci." />
          )}
          {livraisonsFiltrees.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Statut', 'Mois prévu', 'N° Contrat', 'Réf. fourn.', 'Fournisseur', 'Agriculteur', 'Produit', 'Enlèvement', 'Destination', 'Tonnes', 'Date confirmée / Semaine', 'CMR', 'Facturé'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {livraisonsFiltrees.map((l: any) => {
                const moisPrevuDate = l.mois_prevu ? new Date(l.mois_prevu) : null
                const maintenant = new Date()
                const debutMoisActuel = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)
                const isEnRetard = moisPrevuDate && moisPrevuDate < debutMoisActuel && l.type === 'planifiee'
                const isOrganisee = l.type === 'planifiee' && (l.transporteur_contacte || l.date_prevue || l.semaine_prevue)
                return (
                <tr key={l.id} className={`table-row ${isEnRetard ? 'bg-red-50/50' : l.type === 'planifiee' ? 'bg-amber-50/30' : ''}`}>
                  <td className="table-cell">
                    {l.type === 'realisee'
                      ? <span className="badge-clos text-xs">Réalisée</span>
                      : isEnRetard
                        ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠️ En retard</span>
                        : isOrganisee
                          ? <span className="badge-en_cours text-xs">Planifiée</span>
                          : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">À organiser</span>
                    }
                  </td>
                  <td className="table-cell text-sm">
                    {l.mois_prevu ? (
                      <span className={isEnRetard ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                        {new Date(l.mois_prevu).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="table-cell font-mono text-xs">{l.contrat_achat?.numero_contrat ?? '—'}</td>
                  <td className="table-cell text-xs text-gray-500">{l.contrat_achat?.reference_fournisseur ?? '—'}</td>
                  <td className="table-cell text-sm">{l.contrat_achat?.fournisseur?.nom ?? '—'}</td>
                  <td className="table-cell text-sm">
                    {(() => {
                      const cv = (l.contrat_achat?.contrats_vente ?? []).find((cv: any) => cv.id === l.contrat_vente_id)
                      if (cv?.destination_silo) return <span className="text-amber-700 text-xs">🏚 {cv.silo_nom ?? 'Silo'}</span>
                      return cv?.agriculteur?.nom ?? <span className="text-gray-300">—</span>
                    })()}
                  </td>
                  <td className="table-cell text-sm">{l.contrat_achat?.produit?.nom ?? '—'}</td>
                  <td className="table-cell">{l.ville_chargement ?? l.contrat_achat?.ville_chargement ?? '—'}</td>
                  <td className="table-cell">{l.ville_destination ?? '—'}</td>
                  <td className="table-cell font-semibold">
                    {l.type === 'planifiee' ? formatTonnes(l.quantite_prevue) : formatTonnes(l.quantite_reelle)}
                  </td>
                  <td className="table-cell">
                    {l.type === 'realisee'
                      ? <span className="text-sm text-gray-700">{formatDate(l.date_reelle)}</span>
                      : <DateSemaineCell livraison={l} onSaved={() => {
                          fetch(`/api/livraisons?transporteur_id=${selectedTransporteur}&mois=${selectedMois}-01`)
                            .then(r => r.json()).then(setLivraisonsTransporteur)
                        }} />
                    }
                  </td>
                  <td className="table-cell">
                    {l.type === 'planifiee' ? <span className="text-gray-400 text-xs">—</span>
                      : l.numero_lettre_voiture
                        ? <span className="badge-clos">{l.numero_lettre_voiture}</span>
                        : <span className="badge-alerte">Manquant</span>
                    }
                  </td>
                  <td className="table-cell">
                    {l.type === 'planifiee' ? <span className="text-gray-400 text-xs">—</span>
                      : l.transport_facture
                        ? <span className="badge-clos">✓</span>
                        : <span className="badge-en_cours">Non</span>
                    }
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
          )}
        </Section>
        )
      })()}

      {/* Contrats en alerte */}
      {alertes.length > 0 && (
        <Section
          icon={<AlertTriangle size={20} />}
          title="Contrats en alerte"
          count={alertes.length}
          color="red"
          subtitle="Date d'échéance proche ou dépassée avec reliquat non livré"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Contrat', 'Produit', 'Fournisseur', 'Vendu à', 'Date fin', 'Reliquat'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alertes.map((c: any) => {
                const rel = reliquat(c.quantite_totale, c.livraisons ?? [])
                const depasse = c.date_fin && new Date(c.date_fin) < new Date()
                const acheteurs = (c.contrats_vente ?? []).map((cv: any) => cv.agriculteur?.nom).filter(Boolean)
                return (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell">
                      <a href={`/contrats/${c.id}`} className="font-medium text-green-700 hover:underline">{c.numero_contrat}</a>
                    </td>
                    <td className="table-cell">{c.produit?.nom ?? '—'}</td>
                    <td className="table-cell">{c.fournisseur?.nom ?? '—'}</td>
                    <td className="table-cell text-sm text-gray-600">
                      {acheteurs.length > 0 ? acheteurs.join(', ') : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="table-cell">
                      <span className={depasse ? 'text-red-600 font-semibold' : 'text-orange-600 font-medium'}>
                        {formatDate(c.date_fin)}
                        {depasse && ' ⚠️'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-red-600 font-bold text-base">{formatTonnes(rel)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Section>
      )}
      {/* Bloc-notes */}
      <BlocNotes />

      {showNouveauContrat && (
        <NouveauContratModal
          onClose={() => setShowNouveauContrat(false)}
          onSaved={() => { setShowNouveauContrat(false); reloadData() }}
        />
      )}
    </div>
    </>
  )
}

// Couleurs de sections aux couleurs Valcausse
const SECTION_COLORS = {
  orange: { bg: '#C8941A', light: '#fff8f0', border: '#f5d08c' },
  red:    { bg: '#dc2626', light: '#fef2f2', border: '#fecaca' },
  blue:   { bg: '#448ab5', light: '#eff6fb', border: '#a8d2e8' },
  brun:   { bg: '#7B2820', light: '#fdf5f3', border: '#e4b5ad' },
}

function Section({ icon, title, count, color, subtitle, children }: {
  icon: React.ReactNode
  title: string
  count: number | null
  color: 'orange' | 'red' | 'blue' | 'brun'
  subtitle?: string
  children: React.ReactNode
}) {
  const c = SECTION_COLORS[color]
  return (
    <div className="card-section overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3"
           style={{ backgroundColor: c.light, borderBottomColor: c.border }}>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0"
          style={{ backgroundColor: c.bg }}
        >
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold" style={{ color: '#3a1e1a' }}>{title}</h2>
            {count !== null && count > 0 && (
              <span
                className="w-6 h-6 text-white text-xs font-bold rounded-full flex items-center justify-center"
                style={{ backgroundColor: c.bg }}
              >
                {count}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: '#7B2820', opacity: 0.7 }}>{subtitle}</p>}
        </div>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-5 py-8 text-center text-gray-500 text-sm">{text}</div>
  )
}

const PRIORITE_CONFIG = {
  haute:   { label: '🔴 Haute',   bg: '#fef2f2', border: '#fecaca', dot: '#dc2626' },
  normale: { label: '🟡 Normale', bg: '#fffbeb', border: '#fde68a', dot: '#d97706' },
  basse:   { label: '🔵 Basse',   bg: '#eff6fb', border: '#bfdbfe', dot: '#3b82f6' },
}

function BlocNotes() {
  const [notes, setNotes] = useState<any[]>([])
  const [nouveau, setNouveau] = useState('')
  const [priorite, setPriorite] = useState<'haute'|'normale'|'basse'>('normale')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/notes').then(r => r.json()).then(d => { if (Array.isArray(d)) setNotes(d) })
  }, [])

  async function ajouter() {
    if (!nouveau.trim()) return
    setSaving(true)
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenu: nouveau.trim(), priorite }),
    })
    const note = await res.json()
    setNotes(prev => [note, ...prev])
    setNouveau('')
    setSaving(false)
  }

  async function toggleFait(note: any) {
    const res = await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fait: !note.fait }),
    })
    const updated = await res.json()
    setNotes(prev => prev.map(n => n.id === note.id ? updated : n))
  }

  async function supprimer(id: string) {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  // Tri : haute → normale → basse, puis par date
  const ORDRE: Record<string, number> = { haute: 0, normale: 1, basse: 2 }
  const actives = notes
    .filter(n => !n.fait)
    .sort((a, b) => (ORDRE[a.priorite] ?? 1) - (ORDRE[b.priorite] ?? 1))
  const faites = notes.filter(n => n.fait)

  return (
    <div className="card-section overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3" style={{ backgroundColor: '#fdf5f3' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: '#7B2820' }}>
          <CheckSquare size={18} />
        </div>
        <div>
          <h2 className="font-bold" style={{ color: '#3a1e1a' }}>Notes & rappels</h2>
          <p className="text-xs" style={{ color: '#7B2820', opacity: 0.7 }}>Mémos, choses importantes, rappels personnels</p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {/* Saisie */}
        <div className="flex gap-2">
          <select
            value={priorite}
            onChange={e => setPriorite(e.target.value as any)}
            className="input w-36 text-xs py-2"
          >
            <option value="haute">🔴 Haute</option>
            <option value="normale">🟡 Normale</option>
            <option value="basse">🔵 Basse</option>
          </select>
          <input
            type="text"
            value={nouveau}
            onChange={e => setNouveau(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ajouter()}
            placeholder="Ajouter une note ou un rappel..."
            className="input flex-1 text-sm"
          />
          <button onClick={ajouter} disabled={!nouveau.trim() || saving}
            className="px-3 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40 flex items-center gap-1"
            style={{ backgroundColor: '#7B2820' }}>
            <Plus size={15} /> Ajouter
          </button>
        </div>

        {/* Notes actives */}
        {actives.length === 0 && faites.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Aucune note pour l'instant</p>
        )}
        <div className="space-y-2">
          {actives.map(note => {
            const p = PRIORITE_CONFIG[note.priorite as keyof typeof PRIORITE_CONFIG] ?? PRIORITE_CONFIG.normale
            return (
              <div key={note.id} className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 group border" style={{ backgroundColor: p.bg, borderColor: p.border }}>
                <button onClick={() => toggleFait(note)} className="mt-0.5 flex-shrink-0 transition-colors" style={{ color: p.dot }}>
                  <Square size={16} />
                </button>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-800 leading-snug">{note.contenu}</span>
                </div>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 self-center" style={{ color: p.dot, backgroundColor: p.border }}>
                  {note.priorite}
                </span>
                <button onClick={() => supprimer(note.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 flex-shrink-0 self-center">
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>

        {/* Notes faites (repliées) */}
        {faites.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
              ✓ {faites.length} note{faites.length > 1 ? 's' : ''} réalisée{faites.length > 1 ? 's' : ''}
            </summary>
            <div className="space-y-1.5 mt-2">
              {faites.map(note => (
                <div key={note.id} className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 group opacity-60">
                  <button onClick={() => toggleFait(note)} className="mt-0.5 text-green-500 hover:text-gray-400 transition-colors flex-shrink-0">
                    <CheckSquare size={16} />
                  </button>
                  <span className="text-sm text-gray-500 flex-1 line-through leading-snug">{note.contenu}</span>
                  <button onClick={() => supprimer(note.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

    </div>
  )
}

function DateSemaineCell({ livraison, onSaved }: { livraison: any; onSaved: () => void }) {
  const [date, setDate] = useState(livraison.date_prevue ?? '')
  const [semaine, setSemaine] = useState(livraison.semaine_prevue ?? '')
  const [saving, setSaving] = useState(false)

  async function save(field: 'date_prevue' | 'semaine_prevue', value: string) {
    if (saving) return
    setSaving(true)
    await fetch(`/api/livraisons/${livraison.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date_prevue: field === 'date_prevue' ? (value || null) : null,
        semaine_prevue: field === 'semaine_prevue' ? (value || null) : null,
      }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="flex flex-col gap-1 min-w-[150px]">
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400 w-14 shrink-0">Date :</span>
        <input
          type="date"
          value={date}
          onChange={e => { setDate(e.target.value); setSemaine('') }}
          onBlur={e => save('date_prevue', e.target.value)}
          className="text-xs border border-gray-200 rounded px-1.5 py-0.5 w-full focus:outline-none focus:border-orange-400"
        />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400 w-14 shrink-0">Semaine :</span>
        <input
          type="text"
          value={semaine}
          placeholder="ex: S23"
          onChange={e => { setSemaine(e.target.value); setDate('') }}
          onBlur={e => save('semaine_prevue', e.target.value)}
          className="text-xs border border-gray-200 rounded px-1.5 py-0.5 w-full focus:outline-none focus:border-orange-400"
        />
      </div>
      {saving && <span className="text-xs text-gray-400">Enreg...</span>}
    </div>
  )
}
