'use client'
import { useEffect, useState } from 'react'
import { Truck, FileWarning, Receipt, Phone, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react'
import { formatDate, formatTonnes, formatMois, getAnneeAgricoleLabel } from '@/lib/annee-agricole'
import { joursDepuis, quantiteLivree, reliquat } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTransporteur, setSelectedTransporteur] = useState('')
  const [selectedMois, setSelectedMois] = useState('')
  const [transporteurs, setTransporteurs] = useState<any[]>([])
  const [livraisonsTransporteur, setLivraisonsTransporteur] = useState<any[]>([])

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
  }, [])

  useEffect(() => {
    if (!selectedTransporteur) return
    fetch(`/api/livraisons?transporteur_id=${selectedTransporteur}&mois=${selectedMois}-01&type=realisee`)
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
  const cmr = data?.cmrEnAttente ?? []
  const facturesMq = data?.facturesManquantes ?? []
  const alertes = (data?.contratsAlerte ?? []).filter((c: any) => reliquat(c.quantite_totale, c.livraisons ?? []) > 0)

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#7B2820' }}>Tableau de bord</h1>
        <p className="text-gray-500 text-sm mt-0.5">Année agricole {getAnneeAgricoleLabel()} · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

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

      {/* Section Livraisons à planifier */}
      <Section
        icon={<Truck size={20} />}
        title="Livraisons à planifier ce mois-ci"
        count={planifiees.length}
        color="brun"
        subtitle="Transporteur non encore contacté"
      >
        {planifiees.length === 0 ? (
          <EmptyState text="Aucune livraison en attente ce mois-ci 🎉" />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Produit', 'Fournisseur', 'Destination', 'Ville enlèv.', 'Ville dest.', 'Tonnes', 'Mois', 'Contacté ?'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planifiees.map((l: any) => {
                const ca = l.contrat_achat
                const agri = ca?.contrats_vente?.[0]?.agriculteur
                return (
                  <tr key={l.id} className="table-row">
                    <td className="table-cell font-medium">{ca?.produit?.nom ?? '—'}</td>
                    <td className="table-cell">{ca?.fournisseur?.nom ?? '—'}</td>
                    <td className="table-cell">{agri?.nom ?? '—'}</td>
                    <td className="table-cell text-gray-500">{l.ville_chargement ?? ca?.ville_chargement ?? '—'}</td>
                    <td className="table-cell text-gray-500">{l.ville_destination ?? agri?.ville_livraison ?? '—'}</td>
                    <td className="table-cell font-semibold">{formatTonnes(l.quantite_prevue)}</td>
                    <td className="table-cell">{formatMois(l.mois_prevu)}</td>
                    <td className="table-cell">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={l.transporteur_contacte}
                          onChange={() => toggleTransporteurContacte(l.id, l.transporteur_contacte)}
                          className="w-4 h-4 rounded accent-green-600"
                        />
                        <span className="text-xs text-gray-500">{l.transporteur_contacte ? 'Oui' : 'Non'}</span>
                      </label>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* Section CMR */}
      <Section
        icon={<FileWarning size={20} />}
        title="CMR en attente"
        count={cmr.length}
        color="red"
        subtitle="Livraisons réalisées depuis > 14 jours sans lettre de voiture"
      >
        {cmr.length === 0 ? (
          <EmptyState text="Aucun CMR en attente 🎉" />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Produit', 'Transporteur', 'Date livraison', 'Contact transporteur', 'Délai'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cmr.map((l: any) => {
                const jours = joursDepuis(l.date_reelle)
                return (
                  <tr key={l.id} className="table-row">
                    <td className="table-cell font-medium">{l.contrat_achat?.produit?.nom ?? '—'}</td>
                    <td className="table-cell">{l.contrat_achat?.transporteur?.nom ?? '—'}</td>
                    <td className="table-cell">{formatDate(l.date_reelle)}</td>
                    <td className="table-cell text-sm">
                      {l.contrat_achat?.transporteur?.telephone && (
                        <span className="text-gray-600">📞 {l.contrat_achat.transporteur.telephone}</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className="badge-alerte">{jours}j</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* Section Factures clients */}
      <Section
        icon={<Receipt size={20} />}
        title="Factures clients à récupérer"
        count={facturesMq.length}
        color="brun"
        subtitle="Livraisons réalisées depuis > 30 jours sans facture client — aller chercher le numéro dans Atys"
      >
        {facturesMq.length === 0 ? (
          <EmptyState text="Toutes les factures sont à jour 🎉" />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Agriculteur', 'Produit', 'Date livraison', 'Contrat vente'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facturesMq.map((l: any) => {
                const cv = l.contrat_achat?.contrats_vente?.[0]
                return (
                  <tr key={l.id} className="table-row">
                    <td className="table-cell font-medium">{cv?.agriculteur?.nom ?? '—'}</td>
                    <td className="table-cell">{l.contrat_achat?.produit?.nom ?? '—'}</td>
                    <td className="table-cell">{formatDate(l.date_reelle)}</td>
                    <td className="table-cell">
                      {cv ? (
                        <a href={`/ventes`} className="text-green-700 hover:underline text-sm">{cv.numero_contrat}</a>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
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
          <EmptyState text="Aucune livraison réalisée pour ce transporteur ce mois-ci." />
        )}
        {livraisonsTransporteur.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Enlèvement', 'Destination', 'Date', 'Tonnes', 'CMR', 'Facturé'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {livraisonsTransporteur.map((l: any) => (
                <tr key={l.id} className="table-row">
                  <td className="table-cell">{l.ville_chargement ?? '—'}</td>
                  <td className="table-cell">{l.ville_destination ?? '—'}</td>
                  <td className="table-cell">{formatDate(l.date_reelle)}</td>
                  <td className="table-cell font-semibold">{formatTonnes(l.quantite_reelle)}</td>
                  <td className="table-cell">
                    {l.numero_lettre_voiture
                      ? <span className="badge-clos">{l.numero_lettre_voiture}</span>
                      : <span className="badge-alerte">Manquant</span>
                    }
                  </td>
                  <td className="table-cell">
                    {l.transport_facture
                      ? <span className="badge-clos">✓</span>
                      : <span className="badge-en_cours">Non</span>
                    }
                  </td>
                </tr>
              ))}
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
    </div>
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
