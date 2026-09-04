'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  Loader2, CalendarRange, Download, CheckCircle2, Clock, PackageSearch, ChevronUp, ChevronDown, X
} from 'lucide-react'
import {
  trierLignes, filtrerLignes, filtrerNonPlanifiees, NIVEAUX,
  type TriChamp, type Ordre, type FiltresRapport, type NiveauLivraison,
} from '@/lib/rapport-transports'

const BRUN = '#7B2820'

function niveauInfo(key: NiveauLivraison) {
  return NIVEAUX.find(n => n.key === key) ?? NIVEAUX[0]
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function addDaysISO(iso: string, days: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}
function fmtTonnes(n: number | null | undefined) {
  return n != null ? `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} t` : '—'
}
function fmtLigneDate(l: any) {
  return l.date ? fmtDate(l.date) : (l.periodeLabel || '—')
}

interface Rapport {
  realisees: any[]
  planifiees: any[]
  nonPlanifiees: any[]
}

export default function RapportTransportsPage() {
  const [dateDebut, setDateDebut] = useState(todayISO())
  const [dateFin, setDateFin] = useState(addDaysISO(todayISO(), 6))
  const [data, setData] = useState<Rapport | null>(null)
  const [loading, setLoading] = useState(true)

  const [tri, setTri] = useState<TriChamp>('date')
  const [ordre, setOrdre] = useState<Ordre>('asc')
  // Cases décochées = valeurs exclues de l'affichage. Tout est coché (rien
  // d'exclu) par défaut ; décocher une valeur l'exclut immédiatement, cocher
  // "Tout décocher" exclut toutes les valeurs actuellement listées.
  const [exclusFournisseurs, setExclusFournisseurs] = useState<string[]>([])
  const [exclusAgriculteurs, setExclusAgriculteurs] = useState<string[]>([])
  const [exclusStatuts, setExclusStatuts] = useState<NiveauLivraison[]>([])
  const [filtreContrat, setFiltreContrat] = useState('')
  const [filtreProduit, setFiltreProduit] = useState('')

  const charger = useCallback((debut: string, fin: string) => {
    setLoading(true)
    fetch(`/api/rapport-transports?date_debut=${debut}&date_fin=${fin}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
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
    ;[...(data?.realisees ?? []), ...(data?.planifiees ?? [])].forEach(r => { if (r.fournisseur && r.fournisseur !== '—') s.add(r.fournisseur) })
    return [...s].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [data])

  const agriculteurs = useMemo(() => {
    const s = new Set<string>()
    ;[...(data?.realisees ?? []), ...(data?.planifiees ?? [])].forEach(r => { if (r.agriculteur && r.agriculteur !== '—') s.add(r.agriculteur) })
    return [...s].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [data])

  const produits = useMemo(() => {
    const s = new Set<string>()
    ;[...(data?.realisees ?? []), ...(data?.planifiees ?? [])].forEach(r => { if (r.produit && r.produit !== '—') s.add(r.produit) })
    return [...s].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [data])

  const statutsInclus = NIVEAUX.map(n => n.key).filter(k => !exclusStatuts.includes(k))
  const fournisseursInclus = fournisseurs.filter(f => !exclusFournisseurs.includes(f))
  const agriculteursInclus = agriculteurs.filter(a => !exclusAgriculteurs.includes(a))

  const filtres: FiltresRapport = {
    fournisseurs: exclusFournisseurs.length ? fournisseursInclus : undefined,
    agriculteurs: exclusAgriculteurs.length ? agriculteursInclus : undefined,
    contrat: filtreContrat || undefined,
    produit: filtreProduit || undefined,
    statuts: exclusStatuts.length ? statutsInclus : undefined,
  }
  const filtresActifs = !!(exclusFournisseurs.length || exclusAgriculteurs.length || filtreContrat || filtreProduit || exclusStatuts.length)
  function resetFiltres() {
    setExclusFournisseurs([]); setExclusAgriculteurs([]); setFiltreContrat(''); setFiltreProduit(''); setExclusStatuts([])
  }

  const realiseesAffichees = data ? trierLignes(filtrerLignes(data.realisees, filtres), tri, ordre) : []
  const planifieesAffichees = data ? trierLignes(filtrerLignes(data.planifiees, filtres), tri, ordre) : []
  const nonPlanifieesAffichees = data ? filtrerNonPlanifiees(data.nonPlanifiees, filtres) : []

  const pdfParams = new URLSearchParams({ date_debut: dateDebut, date_fin: dateFin, tri, ordre })
  if (exclusFournisseurs.length) fournisseursInclus.forEach(f => pdfParams.append('fournisseur', f))
  if (exclusAgriculteurs.length) agriculteursInclus.forEach(a => pdfParams.append('agriculteur', a))
  if (filtreContrat) pdfParams.set('contrat', filtreContrat)
  if (filtreProduit) pdfParams.set('produit', filtreProduit)
  if (exclusStatuts.length) statutsInclus.forEach(s => pdfParams.append('statut', s))
  const pdfHref = `/api/pdf/rapport-transports?${pdfParams.toString()}`

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: BRUN }}>Rapport transports</h1>
          <p className="text-gray-500 text-sm mt-0.5">Réalisés, en attente et non planifiés sur une période — vue imprimable</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <CalendarRange size={16} />
            Du
          </div>
          <input type="date" className="input text-sm py-1.5 w-40" value={dateDebut} onChange={e => onChangeDebut(e.target.value)} />
          <span className="text-sm text-gray-500">au</span>
          <input type="date" className="input text-sm py-1.5 w-40" value={dateFin} onChange={e => onChangeFin(e.target.value)} />
          <a
            href={pdfHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors hover:brightness-110"
            style={{ backgroundColor: BRUN }}
          >
            <Download size={16} />
            Télécharger le PDF
          </a>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 flex-wrap">
        <FiltreCoches
          label="Fournisseurs"
          options={fournisseurs.map(f => ({ value: f, label: f }))}
          exclus={exclusFournisseurs}
          onChange={setExclusFournisseurs}
        />
        <FiltreCoches
          label="Agriculteurs"
          options={agriculteurs.map(a => ({ value: a, label: a }))}
          exclus={exclusAgriculteurs}
          onChange={setExclusAgriculteurs}
        />
        <input
          type="text"
          placeholder="N° de contrat..."
          value={filtreContrat}
          onChange={e => setFiltreContrat(e.target.value)}
          className="input text-sm py-1.5 w-40"
        />
        <select value={filtreProduit} onChange={e => setFiltreProduit(e.target.value)} className="input text-sm py-1.5 w-40">
          <option value="">Toutes céréales</option>
          {produits.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <FiltreCoches
          label="Statuts"
          options={NIVEAUX.map(n => ({ value: n.key, label: n.label, dot: n.hex }))}
          exclus={exclusStatuts}
          onChange={v => setExclusStatuts(v as NiveauLivraison[])}
        />
        {filtresActifs && (
          <button onClick={resetFiltres} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 px-2 py-1.5">
            <X size={14} /> Réinitialiser
          </button>
        )}
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
        {NIVEAUX.map(n => (
          <span key={n.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: n.hex }} />
            {n.label}
          </span>
        ))}
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-green-600" size={32} />
        </div>
      ) : (
        <>
          <SectionRealisees rows={realiseesAffichees} tri={tri} ordre={ordre} onSort={onSort} />
          <SectionPlanifiees rows={planifieesAffichees} tri={tri} ordre={ordre} onSort={onSort} />
          <SectionNonPlanifiees rows={nonPlanifieesAffichees} />
        </>
      )}
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap ${className}`}>{children}</th>
}
function ThSort({ label, field, tri, ordre, onSort, className = '' }: {
  label: string; field: TriChamp; tri: TriChamp; ordre: Ordre; onSort: (f: TriChamp) => void; className?: string
}) {
  const active = tri === field
  return (
    <th
      onClick={() => onSort(field)}
      className={`px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer select-none transition-colors ${active ? 'text-gray-900' : 'text-gray-600 hover:text-gray-800'} ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (ordre === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </span>
    </th>
  )
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>
}
function StatutDot({ color, title }: { color: string; title: string }) {
  return <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} title={title} />
}

/** Menu à cases à cocher : tout est coché (visible) par défaut, décocher une
 *  valeur l'exclut de l'affichage. `exclus` porte donc les valeurs à masquer,
 *  pas celles à montrer — une nouvelle valeur (ex: nouveau fournisseur après
 *  changement de période) apparaît donc cochée/visible tant qu'on ne l'exclut
 *  pas explicitement. */
function FiltreCoches({ label, options, exclus, onChange }: {
  label: string
  options: { value: string; label: string; dot?: string }[]
  exclus: string[]
  onChange: (exclus: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function toggle(v: string) {
    onChange(exclus.includes(v) ? exclus.filter(x => x !== v) : [...exclus, v])
  }

  const nbCoches = options.filter(o => !exclus.includes(o.value)).length
  const actif = nbCoches < options.length

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input text-sm py-1.5 px-3 flex items-center gap-1.5"
        style={actif ? { borderColor: BRUN, color: BRUN, fontWeight: 600 } : {}}
      >
        {label}
        {actif && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full text-white text-[11px] font-bold flex items-center justify-center" style={{ backgroundColor: BRUN }}>
            {nbCoches}
          </span>
        )}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 max-h-72 overflow-auto rounded-lg border shadow-xl z-20" style={{ borderColor: '#ede9e3', backgroundColor: '#fff' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b text-xs sticky top-0" style={{ borderColor: '#f0ece6', backgroundColor: '#fff' }}>
            <button type="button" onClick={() => onChange([])} className="text-gray-500 hover:text-gray-800 underline">
              Tout cocher
            </button>
            <button type="button" onClick={() => onChange(options.map(o => o.value))} className="text-gray-500 hover:text-gray-800 underline">
              Tout décocher
            </button>
          </div>
          {options.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-gray-400">Aucune option</p>
          ) : (
            <div className="py-1">
              {options.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={!exclus.includes(opt.value)} onChange={() => toggle(opt.value)} />
                  {opt.dot && <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: opt.dot }} />}
                  <span className="flex-1 truncate">{opt.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SectionRealisees({ rows, tri, ordre, onSort }: { rows: any[]; tri: TriChamp; ordre: Ordre; onSort: (f: TriChamp) => void }) {
  const total = rows.reduce((s, r) => s + (r.quantite ?? 0), 0)
  return (
    <div className="card overflow-hidden p-0">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-green-600" />
          <h2 className="font-semibold text-gray-800">Transports réalisés</h2>
          <span className="text-xs text-gray-400">({rows.length})</span>
        </div>
        {rows.length > 0 && <span className="text-sm font-semibold text-green-700">{fmtTonnes(total)}</span>}
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-gray-400 text-sm">Aucun transport réalisé sur cette période (ou filtré par les critères actifs).</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-xs table-fixed">
            <thead style={{ backgroundColor: '#fdf5f3' }}>
              <tr>
                <ThSort label="Date" field="date" tri={tri} ordre={ordre} onSort={onSort} className="w-24" />
                <Th className="w-28">Produit</Th>
                <ThSort label="N° Contrat" field="contrat" tri={tri} ordre={ordre} onSort={onSort} className="w-28" />
                <ThSort label="Fournisseur" field="fournisseur" tri={tri} ordre={ordre} onSort={onSort} className="w-28" />
                <Th className="w-32">Origine</Th>
                <Th className="w-28">Destination</Th>
                <ThSort label="Agriculteur" field="agriculteur" tri={tri} ordre={ordre} onSort={onSort} className="w-32" />
                <Th className="w-24">Transporteur</Th>
                <Th className="text-right w-20">Quantité</Th>
                <ThSort label="Statut" field="statut" tri={tri} ordre={ordre} onSort={onSort} className="w-16" />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const n = niveauInfo(r.niveau)
                return (
                  <tr key={r.id} className="border-t border-gray-100" style={{ borderLeft: `4px solid ${n.hex}` }}>
                    <Td>{fmtLigneDate(r)}</Td>
                    <Td className="font-medium text-gray-800">{r.produit}</Td>
                    <Td className="font-mono text-gray-600">{r.numeroContrat}</Td>
                    <Td>{r.fournisseur}</Td>
                    <Td>{r.origine}</Td>
                    <Td>{r.destination}</Td>
                    <Td>{r.agriculteur}</Td>
                    <Td>{r.transporteur}</Td>
                    <Td className="text-right font-semibold whitespace-nowrap">{fmtTonnes(r.quantite)}</Td>
                    <Td><StatutDot color={n.hex} title={n.label} /></Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SectionPlanifiees({ rows, tri, ordre, onSort }: { rows: any[]; tri: TriChamp; ordre: Ordre; onSort: (f: TriChamp) => void }) {
  const total = rows.reduce((s, r) => s + (r.quantite ?? 0), 0)
  return (
    <div className="card overflow-hidden p-0">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-orange-500" />
          <h2 className="font-semibold text-gray-800">Planifiés — en attente</h2>
          <span className="text-xs text-gray-400">({rows.length})</span>
        </div>
        {rows.length > 0 && <span className="text-sm font-semibold" style={{ color: BRUN }}>{fmtTonnes(total)}</span>}
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-gray-400 text-sm">Aucun transport planifié sur cette période (ou filtré par les critères actifs).</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-xs table-fixed">
            <thead style={{ backgroundColor: '#fff3d0' }}>
              <tr>
                <ThSort label="Date confirmée" field="date" tri={tri} ordre={ordre} onSort={onSort} className="w-28" />
                <Th className="w-28">Produit</Th>
                <ThSort label="N° Contrat" field="contrat" tri={tri} ordre={ordre} onSort={onSort} className="w-28" />
                <ThSort label="Fournisseur" field="fournisseur" tri={tri} ordre={ordre} onSort={onSort} className="w-28" />
                <Th className="w-32">Origine</Th>
                <Th className="w-28">Destination</Th>
                <ThSort label="Agriculteur" field="agriculteur" tri={tri} ordre={ordre} onSort={onSort} className="w-32" />
                <Th className="w-24">Transporteur</Th>
                <Th className="text-right w-20">Quantité</Th>
                <ThSort label="Statut" field="statut" tri={tri} ordre={ordre} onSort={onSort} className="w-16" />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const n = niveauInfo(r.niveau)
                return (
                  <tr key={r.id} className="border-t border-gray-100" style={{ borderLeft: `4px solid ${n.hex}` }}>
                    <Td className={r.dateApproximative ? 'text-orange-600 italic' : ''}>
                      {r.dateApproximative && '~ '}{fmtLigneDate(r)}
                    </Td>
                    <Td className="font-medium text-gray-800">{r.produit}</Td>
                    <Td className="font-mono text-gray-600">{r.numeroContrat}</Td>
                    <Td>{r.fournisseur}</Td>
                    <Td>{r.origine}</Td>
                    <Td>{r.destination}</Td>
                    <Td>{r.agriculteur}</Td>
                    <Td>{r.transporteur}</Td>
                    <Td className="text-right font-semibold whitespace-nowrap">{fmtTonnes(r.quantite)}</Td>
                    <Td><StatutDot color={n.hex} title={n.label} /></Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SectionNonPlanifiees({ rows }: { rows: any[] }) {
  const total = rows.reduce((s, r) => s + (r.quantiteRestante ?? 0), 0)
  return (
    <div className="card overflow-hidden p-0">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <PackageSearch size={18} className="text-red-600" />
          <h2 className="font-semibold text-gray-800">Non planifiés</h2>
          <span className="text-xs text-gray-400">({rows.length})</span>
        </div>
        {rows.length > 0 && <span className="text-sm font-semibold text-red-600">{fmtTonnes(total)} restant</span>}
      </div>
      <p className="px-5 pt-3 text-xs text-gray-400">
        Contrats dont la date de fin tombe avant la fin de période choisie, avec du reliquat, sans aucun transport programmé sur ces dates.
      </p>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-center text-gray-400 text-sm">Aucun contrat en alerte sur cette période (ou filtré par les critères actifs).</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-xs mt-1 table-fixed">
            <thead style={{ backgroundColor: '#fee2e2' }}>
              <tr>
                <Th className="w-28">N° Contrat</Th><Th className="w-28">Produit</Th><Th className="w-36">Fournisseur</Th>
                <Th className="w-48">Agriculteur(s)</Th><Th className="w-32">Transporteur habituel</Th><Th className="w-24">Fin contrat</Th><Th className="text-right w-20">Reliquat</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.contratId} className="border-t border-gray-100">
                  <Td className="font-mono text-gray-600">{r.numeroContrat}</Td>
                  <Td className="font-medium text-gray-800">{r.produit}</Td>
                  <Td>{r.fournisseur}</Td>
                  <Td>{r.agriculteurs}</Td>
                  <Td>{r.transporteur}</Td>
                  <Td className="whitespace-nowrap">{fmtDate(r.dateFinContrat)}</Td>
                  <Td className="text-right font-semibold text-red-600 whitespace-nowrap">{fmtTonnes(r.quantiteRestante)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
