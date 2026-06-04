'use client'
import { getDashboardData } from './actions'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Phone, AlertTriangle, TrendingUp, Loader2, Plus, Trash2, CheckSquare, Square, CalendarDays, CheckCircle2, Circle, ClipboardList, CheckCircle, Wheat, Sprout } from 'lucide-react'
import { formatDate, formatTonnes, getAnneeAgricoleLabel } from '@/lib/annee-agricole'
import { quantiteLivree, reliquat } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import CalendrierLivraisons from '@/components/ui/CalendrierLivraisons'
import { useAdmin } from '@/components/ui/AdminProvider'
import Link from 'next/link'

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
  const contrats = data?.contrats ?? []
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

      {/* Résumé année — cartes aux couleurs Valcausse */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { label: 'Contrats en cours', value: contratsEnCours, Icon: ClipboardList, iconBg: '#fff3d0', iconColor: '#a37514', bg: '#fffdf7', border: '#f5e4a0' },
          { label: 'Contrats clos', value: contratsClos, Icon: CheckCircle, iconBg: '#dcfce7', iconColor: '#15803d', bg: '#f7fef9', border: '#bbf7d0' },
          { label: 'Négoce livré', value: formatTonnes(parFamille.negoce.livre), Icon: Wheat, iconBg: '#fde8e5', iconColor: '#7B2820', bg: '#fdf8f7', border: '#e4b5ad' },
          { label: 'Appro livré', value: formatTonnes(parFamille.appro.livre), Icon: Sprout, iconBg: '#dbeafe', iconColor: '#2a5570', bg: '#f5f9fe', border: '#a8d2e8' },
        ] as any[]).map(item => (
          <div key={item.label} className="card border" style={{ backgroundColor: item.bg, borderColor: item.border }}>
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: item.iconBg }}
              >
                <item.Icon size={20} style={{ color: item.iconColor }} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-800">{item.value}</div>
            <div className="text-xs font-medium text-gray-500 mt-0.5">{item.label}</div>
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
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 44)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 90, right: 40, top: 4, bottom: 4 }} barSize={22}>
              <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `${v} t`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nom" tick={{ fontSize: 12, fill: '#6b7280' }} width={88} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: any) => [`${v} t`, 'Livré']}
                contentStyle={{ borderRadius: 10, border: '1px solid #ede9e3', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 13 }}
              />
              <Bar dataKey="tonnes" radius={[0, 6, 6, 0]}>
                {chartData.map((_, i) => {
                  const colors = ['#7B2820', '#C8941A', '#448ab5', '#16a34a', '#9333ea', '#e67e22']
                  return <Cell key={i} fill={colors[i % colors.length]} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Calendrier des livraisons */}
      <CalendrierLivraisons />

      {/* ── Onglets Suivi livraisons supprimés — voir menu latéral ── */}

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
