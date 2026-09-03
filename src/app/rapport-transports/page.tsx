'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, CalendarRange, Download, CheckCircle2, AlertTriangle, Clock, CalendarCheck, PackageSearch
} from 'lucide-react'

const BRUN = '#7B2820'

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

  const pdfHref = `/api/pdf/rapport-transports?date_debut=${dateDebut}&date_fin=${dateFin}`

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

      {loading || !data ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-green-600" size={32} />
        </div>
      ) : (
        <>
          <SectionRealisees rows={data.realisees} />
          <SectionPlanifiees rows={data.planifiees} />
          <SectionNonPlanifiees rows={data.nonPlanifiees} />
        </>
      )}
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap ${className}`}>{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 whitespace-nowrap ${className}`}>{children}</td>
}

function SectionRealisees({ rows }: { rows: any[] }) {
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
        <p className="px-5 py-6 text-center text-gray-400 text-sm">Aucun transport réalisé sur cette période.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead style={{ backgroundColor: '#fdf5f3' }}>
              <tr>
                <Th>Date</Th><Th>Produit</Th><Th>N° Contrat</Th><Th>Fournisseur</Th>
                <Th>Origine</Th><Th>Destination</Th><Th>Agriculteur</Th><Th>Transporteur</Th>
                <Th className="text-right">Quantité</Th><Th>Document</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-gray-100">
                  <Td>{fmtLigneDate(r)}</Td>
                  <Td className="font-medium text-gray-800">{r.produit}</Td>
                  <Td className="font-mono text-gray-600">{r.numeroContrat}</Td>
                  <Td>{r.fournisseur}</Td>
                  <Td>{r.origine}</Td>
                  <Td>{r.destination}</Td>
                  <Td>{r.agriculteur}</Td>
                  <Td>{r.transporteur}</Td>
                  <Td className="text-right font-semibold">{fmtTonnes(r.quantite)}</Td>
                  <Td>
                    {r.cmrManquant
                      ? <span className="flex items-center gap-1 text-red-600 font-semibold"><AlertTriangle size={13} />Manquant</span>
                      : <span className="flex items-center gap-1 text-green-700 font-semibold"><CheckCircle2 size={13} />Complet</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SectionPlanifiees({ rows }: { rows: any[] }) {
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
        <p className="px-5 py-6 text-center text-gray-400 text-sm">Aucun transport planifié sur cette période.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead style={{ backgroundColor: '#fff3d0' }}>
              <tr>
                <Th>Date demandée</Th><Th>Produit</Th><Th>N° Contrat</Th><Th>Fournisseur</Th>
                <Th>Origine</Th><Th>Destination</Th><Th>Agriculteur</Th><Th>Transporteur</Th>
                <Th className="text-right">Quantité</Th><Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-gray-100">
                  <Td>{fmtLigneDate(r)}</Td>
                  <Td className="font-medium text-gray-800">{r.produit}</Td>
                  <Td className="font-mono text-gray-600">{r.numeroContrat}</Td>
                  <Td>{r.fournisseur}</Td>
                  <Td>{r.origine}</Td>
                  <Td>{r.destination}</Td>
                  <Td>{r.agriculteur}</Td>
                  <Td>{r.transporteur}</Td>
                  <Td className="text-right font-semibold">{fmtTonnes(r.quantite)}</Td>
                  <Td>
                    {r.transporteurConfirme
                      ? <span className="flex items-center gap-1 text-blue-700 font-semibold"><CalendarCheck size={13} />Confirmé</span>
                      : <span className="flex items-center gap-1 text-orange-600 font-semibold"><Clock size={13} />À confirmer</span>}
                  </Td>
                </tr>
              ))}
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
        <p className="px-5 py-6 text-center text-gray-400 text-sm">Aucun contrat en alerte sur cette période.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-xs mt-1">
            <thead style={{ backgroundColor: '#fee2e2' }}>
              <tr>
                <Th>N° Contrat</Th><Th>Produit</Th><Th>Fournisseur</Th>
                <Th>Agriculteur(s)</Th><Th>Transporteur habituel</Th><Th>Fin contrat</Th><Th className="text-right">Reliquat</Th>
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
                  <Td>{fmtDate(r.dateFinContrat)}</Td>
                  <Td className="text-right font-semibold text-red-600">{fmtTonnes(r.quantiteRestante)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
