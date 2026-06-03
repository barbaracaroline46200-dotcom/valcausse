'use client'
import { useEffect, useState } from 'react'
import { Truck, FileWarning, Receipt, Phone, AlertTriangle, TrendingUp, Loader2, Plus, Trash2, CheckSquare, Square, CalendarDays, CheckCircle2, Circle } from 'lucide-react'
import { formatDate, formatTonnes, formatMois, getAnneeAgricoleLabel } from '@/lib/annee-agricole'
import { joursDepuis, quantiteLivree, reliquat } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import CalendrierLivraisons from '@/components/ui/CalendrierLivraisons'
import RealiserLivraisonModal from '@/components/livraisons/RealiserLivraisonModal'
import SaisirFactureTransportModal from '@/components/livraisons/SaisirFactureTransportModal'
import SaisirFactureFournisseurModal from '@/components/livraisons/SaisirFactureFournisseurModal'
import { useAdmin } from '@/components/ui/AdminProvider'
import Link from 'next/link'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DashboardPage() {
  const { isAdmin } = useAdmin()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTransporteur, setSelectedTransporteur] = useState('')
  const [selectedMois, setSelectedMois] = useState('')
  const [transporteurs, setTransporteurs] = useState<any[]>([])
  const [livraisonsTransporteur, setLivraisonsTransporteur] = useState<any[]>([])
  const [cmrModal, setCmrModal] = useState<any>(null)
  const [factureTransportModal, setFactureTransportModal] = useState<any>(null)
  const [factureFournisseurModal, setFactureFournisseurModal] = useState<any>(null)
  const [agendaToday, setAgendaToday] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/referentiels/transporteurs').then(r => r.json()),
    ]).then(([d, t]) => {
      setData(d)
      setTransporteurs(t)
      setLoading(false)
    })
    const now = new Date()
    setSelectedMois(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

    // Charger les notes agenda du jour
    fetch(`/api/agenda?date=${todayStr()}`).then(r => r.json()).then(d => setAgendaToday(Array.isArray(d) ? d : []))

    function reloadDashboard() {
      if (document.visibilityState === 'visible') {
        fetch('/api/dashboard').then(r => r.json()).then(d => setData(d))
        fetch(`/api/agenda?date=${todayStr()}`).then(r => r.json()).then(d => setAgendaToday(Array.isArray(d) ? d : []))
      }
    }
    document.addEventListener('visibilitychange', reloadDashboard)
    return () => document.removeEventListener('visibilitychange', reloadDashboard)
  }, [])

  useEffect(() => {
    if (!selectedTransporteur) return
    fetch(`/api/livraisons?transporteur_id=${selectedTransporteur}&mois=${selectedMois}-01`)
      .then(r => r.json())
      .then(setLivraisonsTransporteur)
  }, [selectedTransporteur, selectedMois])

  async function toggleTransporteurContacte(livraisonId: string, current: boolean) {
    await fetch(`/api/livraisons/${livraisonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transporteur_contacte: !current }),
    })
    const d = await fetch('/api/dashboard').then(r => r.json())
    setData(d)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-green-600" size={32} />
    </div>
  )

  // Calculs statistiques année agricole
  const contrats = data?.contrats ?? []
  const parFamille = { appro: { total: 0, livre: 0, contrats: 0 }, negoce: { total: 0, livre: 0, contrats: 0 } }
  const parProduit: Record<string, number> = {}

  contrats.forEach((c: any) => {
    const f = c.famille as 'appro' | 'negoce'
    const livre = quantiteLivree(c.livraisons ?? [])
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

  const planifiees = data?.livraisonsPlanifiees ?? []
  const moisCourant = data?.moisCourant ?? ''
  const moisSuivant = data?.moisSuivant ?? ''
  const cmr = data?.cmrEnAttente ?? []
  const aFacturer = data?.livraisonsAFacturer ?? []
  const rfManquants = data?.rfManquants ?? []
  const facturesMq = data?.facturesManquantes ?? []
  const alertes = (data?.contratsAlerte ?? []).filter((c: any) => reliquat(c.quantite_totale, c.livraisons ?? []) > 0)

  return (
    <>
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#7B2820' }}>Tableau de bord</h1>
        <p className="text-gray-500 text-sm mt-0.5">Année agricole {getAnneeAgricoleLabel()} · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* Bloc Agenda du jour — admin uniquement */}
      {isAdmin && (agendaToday.length > 0) && (
        <div className="rounded-xl border-2 p-4" style={{ borderColor: '#C8941A', backgroundColor: '#fffdf5' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} style={{ color: '#C8941A' }} />
              <span className="font-bold text-sm" style={{ color: '#7B2820' }}>
                Agenda du jour — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
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
                    fetch(`/api/agenda?date=${todayStr()}`).then(r => r.json()).then(d => setAgendaToday(Array.isArray(d) ? d : []))
                  }}
                  className="mt-0.5 flex-shrink-0"
                >
                  {note.fait
                    ? <CheckCircle2 size={18} className="text-green-500" />
                    : <Circle size={18} style={{ color: '#C8941A' }} />
                  }
                </button>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${note.fait ? 'line-through text-gray-400' : 'text-gray-800'}`}>{note.titre}</p>
                  {note.contenu && <p className={`text-xs mt-0.5 ${note.fait ? 'text-gray-300' : 'text-gray-500'}`}>{note.contenu}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Résumé année — cartes aux couleurs Valcausse */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { label: 'Contrats en cours', value: contratsEnCours, icon: '📋', bg: '#fff8f0', border: '#f5d08c', text: '#a37514' },
          { label: 'Contrats clos', value: contratsClos, icon: '✅', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
          { label: 'Négoce livré', value: formatTonnes(parFamille.negoce.livre), icon: '🌾', bg: '#fdf5f3', border: '#e4b5ad', text: '#7B2820' },
          { label: 'Appro livré', value: formatTonnes(parFamille.appro.livre), icon: '🌿', bg: '#eff6fb', border: '#a8d2e8', text: '#2a5570' },
        ] as any[]).map(item => (
          <div key={item.label} className="card border text-center" style={{ backgroundColor: item.bg, borderColor: item.border }}>
            <div className="text-3xl mb-1">{item.icon}</div>
            <div className="text-2xl font-bold" style={{ color: item.text }}>{item.value}</div>
            <div className="text-xs font-semibold mt-0.5" style={{ color: item.text, opacity: 0.8 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Graphique par produit */}
      {chartData.length > 0 && (
        <div className="card">
          <h2 className="font-bold mb-4 flex items-center gap-2" style={{ color: '#7B2820' }}>
            <TrendingUp size={18} style={{ color: '#C8941A' }} />
            Tonnage livré par produit — année agricole {getAnneeAgricoleLabel()}
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 30 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v} t`} />
              <YAxis type="category" dataKey="nom" tick={{ fontSize: 12 }} width={80} />
              <Tooltip formatter={(v: any) => [`${v} t`, 'Livré']} />
              <Bar dataKey="tonnes" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={i % 2 === 0 ? '#7B2820' : '#C8941A'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Calendrier des livraisons */}
      <CalendrierLivraisons />

      {/* Section Livraisons à organiser — process 3 étapes */}
      <Section
        icon={<Truck size={20} />}
        title="Livraisons à organiser"
        count={planifiees.length}
        color="brun"
        subtitle="Mois passés non livrés + mois en cours + mois prochain (dès le 20)"
      >
        {planifiees.length === 0 ? (
          <EmptyState text="Aucune livraison en attente 🎉" />
        ) : (
          <>
            {/* Légende process */}
            <div className="flex items-center gap-6 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 flex-wrap">
              <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">1</span> Appel agri + date souhaitée</div>
              <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">2</span> PDF envoyé au transporteur</div>
              <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs">3</span> Transporteur confirmé + date/semaine</div>
            </div>
            <div className="divide-y divide-gray-100">
              {planifiees.map((l: any) => {
                const ca = l.contrat_achat
                const agri = (ca?.contrats_vente ?? []).find((cv: any) => cv.id === l.contrat_vente_id)?.agriculteur
                  ?? ca?.contrats_vente?.[0]?.agriculteur
                const moisLiv = l.mois_prevu?.slice(0, 7) ?? ''
                const isRetard = moisLiv < moisCourant.slice(0, 7)
                const isProchain = moisSuivant && moisLiv >= moisSuivant.slice(0, 7)
                const step1ok = !!(l.date_souhaitee || l.semaine_souhaitee)
                const step2ok = step1ok && !!l.pdf_envoye
                const step3ok = !!(l.date_prevue || l.semaine_prevue)
                // Étape active = la première non complète
                const etapeActive = step3ok ? 0 : step2ok ? 3 : step1ok ? 2 : 1
                return (
                  <div key={l.id} className={`px-5 py-4 ${isRetard ? 'bg-red-50/40' : isProchain ? 'bg-blue-50/40' : ''}`}>
                    {/* En-tête ligne */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isRetard ? 'bg-red-100 text-red-700' : isProchain ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                        }`}>{isRetard ? '⚠️ ' : isProchain ? '→ ' : ''}{formatMois(l.mois_prevu)}</span>
                        <span className="font-semibold text-gray-800">{ca?.produit?.nom}</span>
                        <span className="text-gray-500 text-sm">{ca?.fournisseur?.nom}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-sm font-medium" style={{ color: '#7B2820' }}>{formatTonnes(l.quantite_prevue)}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-sm text-gray-600">{agri?.nom ?? '—'}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-sm text-gray-500">{ca?.transporteur?.nom ?? '—'}</span>
                      </div>
                      <a href={`/contrats/${ca?.id}`} className="text-xs text-green-700 hover:underline shrink-0">{ca?.numero_contrat}</a>
                    </div>

                    {/* 3 étapes */}
                    <div className={`grid grid-cols-3 gap-3 ${step3ok ? 'opacity-50' : ''}`}>

                      {/* Étape 1 */}
                      <div className={`rounded-lg p-3 border-2 transition-all ${
                        step1ok ? 'border-green-200 bg-green-50' :
                        etapeActive === 1 ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-gray-100 bg-gray-50'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step1ok ? 'bg-green-500 text-white' : etapeActive === 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}>1</span>
                          <span className={`text-xs font-semibold ${etapeActive === 1 ? 'text-blue-700' : 'text-gray-700'}`}>📞 Agri contacté</span>
                        </div>
                        <p className="text-xs text-gray-400 mb-1">Date ou semaine souhaitée par l'agri</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400 w-12 shrink-0">Date :</span>
                            <input type="date" defaultValue={l.date_souhaitee ?? ''} className="text-xs border border-gray-200 rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:border-blue-400"
                              onBlur={async e => {
                                await fetch(`/api/livraisons/${l.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date_souhaitee: e.target.value || null, semaine_souhaitee: e.target.value ? null : undefined, agriculteur_contacte: !!e.target.value }) })
                                const d = await fetch('/api/dashboard').then(r => r.json()); setData(d)
                              }} />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400 w-12 shrink-0">Semaine :</span>
                            <input type="text" placeholder="ex: S23" defaultValue={l.semaine_souhaitee ?? ''} className="text-xs border border-gray-200 rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:border-blue-400"
                              onBlur={async e => {
                                await fetch(`/api/livraisons/${l.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ semaine_souhaitee: e.target.value || null, date_souhaitee: e.target.value ? null : undefined, agriculteur_contacte: !!e.target.value }) })
                                const d = await fetch('/api/dashboard').then(r => r.json()); setData(d)
                              }} />
                          </div>
                        </div>
                      </div>

                      {/* Étape 2 : PDF */}
                      <div className={`rounded-lg p-3 border-2 transition-all ${
                        step2ok ? 'border-green-200 bg-green-50' :
                        etapeActive === 2 ? 'border-orange-400 bg-orange-50 shadow-sm' :
                        step1ok ? 'border-orange-100 bg-orange-50/30' : 'border-gray-100 bg-gray-50 opacity-50'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step2ok ? 'bg-green-500 text-white' : etapeActive === 2 ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'}`}>2</span>
                          <span className={`text-xs font-semibold ${etapeActive === 2 ? 'text-orange-700' : 'text-gray-700'}`}>📄 PDF transporteur</span>
                        </div>
                        {step1ok ? (
                          <div className="text-xs text-gray-600 space-y-2">
                            <p className="text-gray-400">Souhait agri : <strong className="text-gray-700">{l.date_souhaitee ? new Date(l.date_souhaitee).toLocaleDateString('fr-FR') : l.semaine_souhaitee ?? '—'}</strong></p>
                            <a
                              href={`/api/pdf/transporteur?livraison_id=${l.id}`}
                              target="_blank" rel="noopener noreferrer"
                              onClick={async () => {
                                if (!l.pdf_envoye) {
                                  await fetch(`/api/livraisons/${l.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pdf_envoye: true }) })
                                  const d = await fetch('/api/dashboard').then(r => r.json()); setData(d)
                                }
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-medium"
                              style={{ backgroundColor: l.pdf_envoye ? '#16a34a' : '#7B2820' }}>
                              {l.pdf_envoye ? '✓ PDF envoyé' : '📥 Télécharger PDF'}
                            </a>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">Compléter l'étape 1 d'abord</p>
                        )}
                      </div>

                      {/* Étape 3 : Transporteur confirmé + date/semaine */}
                      <div className={`rounded-lg p-3 border-2 transition-all ${
                        step3ok ? 'border-green-200 bg-green-50' :
                        etapeActive === 3 ? 'border-green-400 bg-green-50 shadow-sm' :
                        step1ok ? 'border-green-100 bg-green-50/30' : 'border-gray-100 bg-gray-50 opacity-50'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step3ok ? 'bg-green-500 text-white' : etapeActive === 3 ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'}`}>3</span>
                          <span className={`text-xs font-semibold ${etapeActive === 3 ? 'text-green-700' : 'text-gray-700'}`}>🚛 Transporteur</span>
                        </div>
                        <p className="text-xs text-gray-400 mb-2">Renseigner date <strong>ou</strong> semaine pour valider</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400 w-12 shrink-0">Date :</span>
                            <input type="date" defaultValue={l.date_prevue ?? ''} className="text-xs border border-gray-200 rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:border-green-400"
                              onBlur={async e => {
                                await fetch(`/api/livraisons/${l.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date_prevue: e.target.value || null, semaine_prevue: null }) })
                                const d = await fetch('/api/dashboard').then(r => r.json()); setData(d)
                              }} />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400 w-12 shrink-0">Semaine :</span>
                            <input type="text" placeholder="ex: S23" defaultValue={l.semaine_prevue ?? ''} className="text-xs border border-gray-200 rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:border-green-400"
                              onBlur={async e => {
                                await fetch(`/api/livraisons/${l.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ semaine_prevue: e.target.value || null, date_prevue: null }) })
                                const d = await fetch('/api/dashboard').then(r => r.json()); setData(d)
                              }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Section>

      {/* Section CMR */}
      <Section
        icon={<FileWarning size={20} />}
        title="CMR en attente"
        count={cmr.length}
        color="red"
        subtitle="Date de livraison dépassée sans lettre de voiture"
      >
        {cmr.length === 0 ? (
          <EmptyState text="Aucun CMR en attente 🎉" />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Produit', 'Transporteur', 'Date livraison', 'Contact transporteur', 'Délai', ''].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cmr.map((l: any) => {
                const isRealisee = l.type === 'realisee'
                const dateRef = isRealisee ? l.date_reelle : l.date_prevue
                const jours = joursDepuis(dateRef)
                const dateAffichee = isRealisee
                  ? formatDate(l.date_reelle)
                  : l.date_prevue ? formatDate(l.date_prevue) : (l.semaine_prevue ?? '—')
                return (
                  <tr key={l.id}
                    className={`table-row cursor-pointer hover:bg-red-50 transition-colors ${!isRealisee ? 'bg-amber-50/40' : ''}`}
                    onClick={() => setCmrModal(l)}
                    title="Cliquer pour saisir le CMR">
                    <td className="table-cell font-medium">{l.contrat_achat?.produit?.nom ?? '—'}</td>
                    <td className="table-cell">{l.contrat_achat?.transporteur?.nom ?? '—'}</td>
                    <td className="table-cell">
                      <span className={!isRealisee ? 'text-amber-700 font-medium' : ''}>{dateAffichee}</span>
                      {!isRealisee && <span className="ml-1 text-xs text-amber-600">(prévue)</span>}
                    </td>
                    <td className="table-cell text-sm">
                      {l.contrat_achat?.transporteur?.telephone && (
                        <span className="text-gray-600">📞 {l.contrat_achat.transporteur.telephone}</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className="badge-alerte">{jours}j</span>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs text-red-600 font-medium underline">Saisir CMR →</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* Section Facturation en attente */}
      <Section
        icon={<Receipt size={20} />}
        title="Facturation en attente"
        count={aFacturer.length}
        color="blue"
        subtitle="Livraisons réalisées — transport et/ou fournisseur non encore facturés"
      >
        {aFacturer.length === 0 ? (
          <EmptyState text="Toutes les livraisons sont facturées 🎉" />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Date', 'Produit', 'Contrat', 'Agriculteur', 'Tonnes', 'Transport facturé', 'Fournisseur facturé'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aFacturer.map((l: any) => {
                const ca = l.contrat_achat
                const agri = ca?.contrats_vente?.find((cv: any) => cv.id === l.contrat_vente_id)?.agriculteur
                  ?? ca?.contrats_vente?.[0]?.agriculteur
                return (
                  <tr key={l.id} className="table-row">
                    <td className="table-cell text-sm">{formatDate(l.date_reelle)}</td>
                    <td className="table-cell font-medium">{ca?.produit?.nom ?? '—'}</td>
                    <td className="table-cell">
                      <a href={`/contrats/${ca?.id}`} className="text-green-700 hover:underline text-sm">{ca?.numero_contrat}</a>
                    </td>
                    <td className="table-cell text-sm">{agri?.nom ?? (l.destination_silo ? 'Silo' : '—')}</td>
                    <td className="table-cell font-semibold">{formatTonnes(l.quantite_reelle)}</td>
                    <td className="table-cell text-center">
                      {l.transport_facture
                        ? <span className="badge-clos">✓ Facturé</span>
                        : <button onClick={() => setFactureTransportModal(l)} className="badge-alerte cursor-pointer hover:opacity-80 transition-opacity">⏳ Saisir →</button>
                      }
                    </td>
                    <td className="table-cell text-center">
                      {l.facture_fournisseur_id
                        ? <span className="badge-clos">✓ Facturé</span>
                        : <button onClick={() => setFactureFournisseurModal(l)} className="badge-alerte cursor-pointer hover:opacity-80 transition-opacity">⏳ Saisir →</button>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* Section RF à récupérer */}
      {rfManquants.length > 0 && (
        <Section
          icon={<FileWarning size={20} />}
          title="RF à récupérer"
          count={rfManquants.length}
          color="red"
          subtitle="Factures fournisseur enregistrées — numéro RF manquant (à recevoir de la comptable)"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Fournisseur', 'Produit', 'Contrat', 'N° Facture', 'Date', 'Montant HT', 'Saisir RF'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rfManquants.map((f: any) => (
                <tr key={f.id} className="table-row">
                  <td className="table-cell font-medium">{f.contrat_achat?.fournisseur?.nom ?? '—'}</td>
                  <td className="table-cell">{f.contrat_achat?.produit?.nom ?? '—'}</td>
                  <td className="table-cell">
                    <a href={`/contrats/${f.contrat_achat?.id}`} className="text-green-700 hover:underline text-sm">{f.contrat_achat?.numero_contrat}</a>
                  </td>
                  <td className="table-cell">{f.numero_facture ?? '—'}</td>
                  <td className="table-cell">{formatDate(f.date_facture)}</td>
                  <td className="table-cell">{f.montant_ht ? `${f.montant_ht} €` : '—'}</td>
                  <td className="table-cell">
                    <SaisirRFInline factureId={f.id} onSaved={async () => {
                      const d = await fetch('/api/dashboard').then(r => r.json()); setData(d)
                    }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Section Factures clients */}
      <Section
        icon={<Receipt size={20} />}
        title="Factures clients à récupérer"
        count={facturesMq.length}
        color="brun"
        subtitle="Contrats de vente entièrement livrés depuis + de 30 jours — récupérer les factures dans Atys"
      >
        {facturesMq.length === 0 ? (
          <EmptyState text="Toutes les factures sont à jour 🎉" />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Agriculteur', 'Produit', 'Contrat vente', 'Dernière livraison', 'Factures attendues', 'Mois concernés'].map(h => (
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
                  <td className="table-cell text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold" style={{ backgroundColor: '#7B2820' }}>
                      {item.nb_factures_attendues}
                    </span>
                  </td>
                  <td className="table-cell text-sm text-gray-600">
                    {item.mois_livraison.map((m: string) => formatMois(m + '-01')).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Section Point transporteur */}
      <Section
        icon={<Phone size={20} />}
        title="Point transporteur"
        count={null}
        color="orange"
        subtitle="Outil d'appel — sélectionnez un transporteur et un mois"
      >
        <div className="flex gap-3 mb-4">
          <select
            value={selectedTransporteur}
            onChange={e => setSelectedTransporteur(e.target.value)}
            className="input max-w-xs"
          >
            <option value="">Choisir un transporteur...</option>
            {transporteurs.map((t: any) => (
              <option key={t.id} value={t.id}>{t.nom}</option>
            ))}
          </select>
          <input
            type="month"
            value={selectedMois}
            onChange={e => setSelectedMois(e.target.value)}
            className="input w-40"
          />
        </div>
        {selectedTransporteur && livraisonsTransporteur.length === 0 && (
          <EmptyState text="Aucune livraison pour ce transporteur ce mois-ci." />
        )}
        {livraisonsTransporteur.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Statut', 'Mois prévu', 'Produit', 'Enlèvement', 'Destination', 'Tonnes', 'Date confirmée / Semaine', 'CMR', 'Facturé'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {livraisonsTransporteur.map((l: any) => {
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
                {['Contrat', 'Produit', 'Fournisseur', 'Date fin', 'Reliquat'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alertes.map((c: any) => {
                const rel = reliquat(c.quantite_totale, c.livraisons ?? [])
                const depasse = c.date_fin && new Date(c.date_fin) < new Date()
                return (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell">
                      <a href={`/contrats/${c.id}`} className="font-medium text-green-700 hover:underline">{c.numero_contrat}</a>
                    </td>
                    <td className="table-cell">{c.produit?.nom ?? '—'}</td>
                    <td className="table-cell">{c.fournisseur?.nom ?? '—'}</td>
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

    </div>

    {factureTransportModal && (
      <SaisirFactureTransportModal
        livraison={factureTransportModal}
        onClose={() => setFactureTransportModal(null)}
        onSaved={() => {
          setFactureTransportModal(null)
          fetch('/api/dashboard', { cache: 'no-store' }).then(r => r.json()).then(d => setData(d))
        }}
      />
    )}
    {factureFournisseurModal && (
      <SaisirFactureFournisseurModal
        livraison={factureFournisseurModal}
        onClose={() => setFactureFournisseurModal(null)}
        onSaved={() => {
          setFactureFournisseurModal(null)
          fetch('/api/dashboard', { cache: 'no-store' }).then(r => r.json()).then(d => setData(d))
        }}
      />
    )}
    {cmrModal && (
      <RealiserLivraisonModal
        livraison={cmrModal}
        contrat={cmrModal.contrat_achat}
        onClose={() => setCmrModal(null)}
        onSaved={async () => {
          setCmrModal(null)
          fetch('/api/dashboard').then(r => r.json()).then(d => setData(d))
        }}
      />
    )}
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

function BlocNotes() {
  const [notes, setNotes] = useState<any[]>([])
  const [nouveau, setNouveau] = useState('')
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
      body: JSON.stringify({ contenu: nouveau.trim() }),
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

  const actives = notes.filter(n => !n.fait)
  const faites = notes.filter(n => n.fait)

  return (
    <div className="card-section overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3" style={{ backgroundColor: '#fdf5f3' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0" style={{ backgroundColor: '#7B2820' }}>📝</div>
        <div>
          <h2 className="font-bold" style={{ color: '#3a1e1a' }}>Notes & rappels</h2>
          <p className="text-xs" style={{ color: '#7B2820', opacity: 0.7 }}>Mémos, choses importantes, rappels personnels</p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {/* Saisie */}
        <div className="flex gap-2">
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
          {actives.map(note => (
            <div key={note.id} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 group">
              <button onClick={() => toggleFait(note)} className="mt-0.5 text-amber-400 hover:text-green-500 transition-colors flex-shrink-0">
                <Square size={16} />
              </button>
              <span className="text-sm text-gray-800 flex-1 leading-snug">{note.contenu}</span>
              <button onClick={() => supprimer(note.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 flex-shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
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

function SaisirRFInline({ factureId, onSaved }: { factureId: string; onSaved: () => void }) {
  const [rf, setRf] = useState('')
  const [datePaiement, setDatePaiement] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!rf) return
    setSaving(true)
    await fetch(`/api/factures/fournisseur/${factureId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero_piece_logiciel: rf, date_paiement: datePaiement || null }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text" value={rf} onChange={e => setRf(e.target.value)}
        placeholder="N° RF"
        className="text-xs border border-gray-200 rounded px-1.5 py-0.5 w-20 focus:outline-none focus:border-red-400"
      />
      <input
        type="date" value={datePaiement} onChange={e => setDatePaiement(e.target.value)}
        title="Date de paiement"
        className="text-xs border border-gray-200 rounded px-1.5 py-0.5 w-28 focus:outline-none focus:border-red-400"
      />
      <button onClick={save} disabled={!rf || saving}
        className="text-xs px-2 py-0.5 rounded bg-red-600 text-white disabled:opacity-40 hover:bg-red-700">
        {saving ? '...' : '✓'}
      </button>
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
