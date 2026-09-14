'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Loader2, CalendarRange, Download, AlertTriangle, ChevronUp, ChevronDown, X } from 'lucide-react'
import {
  trierLignes, filtrerLignes, STATUTS,
  type TriChamp, type Ordre, type FiltresControle, type LigneControle, type StatutFacturation,
} from '@/lib/controle-facturation'
import { formatDate, formatTonnes } from '@/lib/annee-agricole'

const ROUGE = '#dc2626'

function statutInfo(key: StatutFacturation) {
  return STATUTS.find(s => s.key === key) ?? STATUTS[0]
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function premierJourMoisMoins(moisAvant: number) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - moisAvant)
  return d.toISOString().slice(0, 10)
}
function ecartLabel(l: LigneControle) {
  if (l.ecartMois == null) return '—'
  if (l.ecartMois === 0) return '0'
  return l.ecartMois > 0 ? `+${l.ecartMois} mois` : `${l.ecartMois} mois`
}

export default function ControleFacturationPage() {
  const [dateDebut, setDateDebut] = useState(premierJourMoisMoins(3))
  const [dateFin, setDateFin] = useState(todayISO())
  const [lignes, setLignes] = useState<LigneControle[]>([])
  const [loading, setLoading] = useState(true)

  const [tri, setTri] = useState<TriChamp>('date')
  const [ordre, setOrdre] = useState<Ordre>('asc')
  const [filtreFournisseur, setFiltreFournisseur] = useState('')
  const [filtreProduit, setFiltreProduit] = useState('')
  const [filtreContrat, setFiltreContrat] = useState('')
  const [filtreStatut, setFiltreStatut] = useState<FiltresControle['statut']>('')

  const charger = useCallback((debut: string, fin: string) => {
    setLoading(true)
    fetch(`/api/controle-facturation?date_debut=${debut}&date_fin=${fin}`)
      .then(r => r.json())
      .then(d => { setLignes(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { charger(dateDebut, dateFin) }, [dateDebut, dateFin, charger])

  function onChangeDebut(v: string) {
    setDateDebut(v)
    if (dateFin < v) setDateFin(v)
  }
  function onChangeFin(v: string) {
    if (v < dateDebut) return
    setDateFin(v)
  }
  function onSort(field: TriChamp) {
    if (tri === field) setOrdre(o => (o === 'asc' ? 'desc' : 'asc'))
    else { setTri(field); setOrdre('asc') }
  }

  const fournisseurs = useMemo(() => {
    const s = new Set<string>()
    lignes.forEach(l => { if (l.fournisseur && l.fournisseur !== '—') s.add(l.fournisseur) })
    return [...s].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [lignes])
  const produits = useMemo(() => {
    const s = new Set<string>()
    lignes.forEach(l => { if (l.produit && l.produit !== '—') s.add(l.produit) })
    return [...s].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [lignes])

  const filtres: FiltresControle = {
    fournisseur: filtreFournisseur || undefined,
    produit: filtreProduit || undefined,
    contrat: filtreContrat || undefined,
    statut: filtreStatut,
  }
  const filtresActifs = !!(filtreFournisseur || filtreProduit || filtreContrat || filtreStatut)
  function resetFiltres() { setFiltreFournisseur(''); setFiltreProduit(''); setFiltreContrat(''); setFiltreStatut('') }

  const lignesAffichees = trierLignes(filtrerLignes(lignes, filtres), tri, ordre)
  const totalQuantite = lignesAffichees.reduce((s, l) => s + (l.quantite ?? 0), 0)

  const compteParStatut = useMemo(() => {
    const m: Record<string, number> = {}
    lignes.forEach(l => { m[l.statut] = (m[l.statut] ?? 0) + 1 })
    return m
  }, [lignes])
  const nbEcarts = compteParStatut['mois_different'] ?? 0

  const pdfParams = new URLSearchParams({ date_debut: dateDebut, date_fin: dateFin, tri, ordre })
  if (filtreFournisseur) pdfParams.set('fournisseur', filtreFournisseur)
  if (filtreProduit) pdfParams.set('produit', filtreProduit)
  if (filtreContrat) pdfParams.set('contrat', filtreContrat)
  if (filtreStatut) pdfParams.set('statut', filtreStatut)
  const pdfHref = `/api/pdf/controle-facturation?${pdfParams.toString()}`

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: ROUGE }}>Contrôle facturation fournisseur</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Compare le mois de la livraison au mois de la facture fournisseur — détecte les décalages
            (ex. livré en juin, facturé en juillet). Période par défaut : 3 derniers mois.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <CalendarRange size={16} />
            Livré du
          </div>
          <input type="date" className="input text-sm py-1.5 w-40" value={dateDebut} onChange={e => onChangeDebut(e.target.value)} />
          <span className="text-sm text-gray-500">au</span>
          <input type="date" className="input text-sm py-1.5 w-40" value={dateFin} onChange={e => onChangeFin(e.target.value)} />
          <a
            href={pdfHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors hover:brightness-110"
            style={{ backgroundColor: ROUGE }}
          >
            <Download size={16} />
            Télécharger le PDF
          </a>
        </div>
      </div>

      {/* Compteurs par statut, cliquables pour filtrer */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUTS.map(s => {
          const n = compteParStatut[s.key] ?? 0
          const actif = filtreStatut === s.key
          return (
            <button
              key={s.key}
              onClick={() => setFiltreStatut(actif ? '' : s.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
              style={actif
                ? { backgroundColor: s.hex, color: '#fff', borderColor: s.hex }
                : { backgroundColor: s.hex + '15', color: s.hex, borderColor: s.hex + '30' }}
            >
              {s.key === 'mois_different' && <AlertTriangle size={12} />}
              {s.label}
              <span className="font-bold">{n}</span>
            </button>
          )
        })}
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={filtreFournisseur} onChange={e => setFiltreFournisseur(e.target.value)} className="input text-sm py-1.5 w-44">
          <option value="">Tous fournisseurs</option>
          {fournisseurs.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filtreProduit} onChange={e => setFiltreProduit(e.target.value)} className="input text-sm py-1.5 w-44">
          <option value="">Tous produits</option>
          {produits.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input
          type="text"
          placeholder="N° de contrat..."
          value={filtreContrat}
          onChange={e => setFiltreContrat(e.target.value)}
          className="input text-sm py-1.5 w-40"
        />
        {filtresActifs && (
          <button onClick={resetFiltres} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 px-2 py-1.5">
            <X size={14} /> Réinitialiser
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-green-600" size={32} />
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800">Livraisons réalisées sur la période</h2>
              <span className="text-xs text-gray-400">({lignesAffichees.length})</span>
              {nbEcarts > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: ROUGE + '15', color: ROUGE }}>
                  <AlertTriangle size={12} /> {nbEcarts} décalage{nbEcarts > 1 ? 's' : ''} de mois
                </span>
              )}
            </div>
            {lignesAffichees.length > 0 && <span className="text-sm font-semibold text-gray-600">{formatTonnes(totalQuantite)}</span>}
          </div>
          {lignesAffichees.length === 0 ? (
            <p className="px-5 py-8 text-center text-gray-400 text-sm">
              {lignes.length === 0 ? 'Aucune livraison réalisée sur cette période.' : 'Aucun résultat pour ces filtres.'}
            </p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  <ThSort label="Livrée le" field="date" tri={tri} ordre={ordre} onSort={onSort} />
                  <ThSort label="Fournisseur" field="fournisseur" tri={tri} ordre={ordre} onSort={onSort} />
                  <ThSort label="Produit" field="produit" tri={tri} ordre={ordre} onSort={onSort} />
                  <ThSort label="Contrat" field="contrat" tri={tri} ordre={ordre} onSort={onSort} />
                  <Th className="text-right">Quantité</Th>
                  <Th>N° facture</Th>
                  <Th>Facturée le</Th>
                  <ThSort label="Écart" field="ecart" tri={tri} ordre={ordre} onSort={onSort} />
                  <Th>Statut</Th>
                </tr></thead>
                <tbody>
                  {lignesAffichees.map(l => {
                    const s = statutInfo(l.statut)
                    return (
                      <tr key={l.id} className="table-row" style={{ borderLeft: `4px solid ${s.hex}` }}>
                        <td className="table-cell">{formatDate(l.dateLivraison)}</td>
                        <td className="table-cell">{l.fournisseur}</td>
                        <td className="table-cell font-medium">{l.produit}</td>
                        <td className="table-cell">
                          {l.contratId
                            ? <a href={`/contrats/${l.contratId}`} className="text-green-700 hover:underline">{l.numeroContrat}</a>
                            : l.numeroContrat}
                        </td>
                        <td className="table-cell text-right font-semibold">{formatTonnes(l.quantite)}</td>
                        <td className="table-cell text-gray-600">{l.numeroFacture ?? '—'}</td>
                        <td className="table-cell">{l.dateFacture ? formatDate(l.dateFacture) : '—'}</td>
                        <td className="table-cell font-semibold" style={{ color: l.ecartMois ? ROUGE : undefined }}>{ecartLabel(l)}</td>
                        <td className="table-cell">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: s.hex + '18', color: s.hex }}>
                            {s.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap ${className}`}>{children}</th>
}
function ThSort({ label, field, tri, ordre, onSort, className = '' }: {
  label: string; field: TriChamp; tri: TriChamp; ordre: Ordre; onSort: (f: TriChamp) => void; className?: string
}) {
  const active = tri === field
  return (
    <th
      onClick={() => onSort(field)}
      className={`px-3 py-2.5 text-left font-semibold text-xs uppercase tracking-wide whitespace-nowrap cursor-pointer select-none transition-colors ${active ? 'text-gray-800' : 'text-gray-500 hover:text-gray-700'} ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (ordre === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </span>
    </th>
  )
}
