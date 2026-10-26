import type { SupabaseClient } from '@supabase/supabase-js'
import { getRapportTransports, type LigneRapport } from './rapport-transports'

export const TYPES_SILO = ['Silo', 'Silo gare'] as const
export type TypeSilo = typeof TYPES_SILO[number]

export interface LigneRapportSilo {
  id: string
  date: string | null
  periodeLabel: string
  dateApproximative: boolean
  quantite: number | null
  produit: string
  numeroContrat: string
  fournisseur: string
  transporteur: string
  silo: TypeSilo
}

export interface TotalProduit {
  produit: string
  total: number
}

function versLigneSilo(l: LigneRapport): LigneRapportSilo | null {
  if (l.silo !== 'Silo' && l.silo !== 'Silo gare') return null
  return {
    id: l.id,
    date: l.date,
    periodeLabel: l.periodeLabel,
    dateApproximative: l.dateApproximative,
    quantite: l.quantite,
    produit: l.produit,
    numeroContrat: l.numeroContrat,
    fournisseur: l.fournisseur,
    transporteur: l.transporteur,
    silo: l.silo,
  }
}

/** Livraisons (réalisées + planifiées) sur la période, limitées à celles
 *  destinées à un silo (gare ou non) — sert de base au rapport silo. */
export async function getRapportSilo(
  supabase: SupabaseClient,
  dateDebut: string,
  dateFin: string
): Promise<LigneRapportSilo[]> {
  const { realisees, planifiees } = await getRapportTransports(supabase, dateDebut, dateFin)
  return [...realisees, ...planifiees]
    .map(versLigneSilo)
    .filter((l): l is LigneRapportSilo => l !== null)
}

export interface FiltresRapportSilo {
  produits?: string[]
  fournisseurs?: string[]
  typesSilo?: TypeSilo[]
}

export function filtrerLignesSilo(rows: LigneRapportSilo[], f: FiltresRapportSilo): LigneRapportSilo[] {
  return rows.filter(r => {
    if (f.produits && f.produits.length > 0 && !f.produits.includes(r.produit)) return false
    if (f.fournisseurs && f.fournisseurs.length > 0 && !f.fournisseurs.includes(r.fournisseur)) return false
    if (f.typesSilo && f.typesSilo.length > 0 && !f.typesSilo.includes(r.silo)) return false
    return true
  })
}

export function trierLignesSilo(rows: LigneRapportSilo[]): LigneRapportSilo[] {
  return [...rows].sort((a, b) => {
    const p = a.produit.localeCompare(b.produit, 'fr')
    if (p !== 0) return p
    return (a.date ?? '9999-99-99').localeCompare(b.date ?? '9999-99-99')
  })
}

export function totauxParProduit(rows: LigneRapportSilo[]): TotalProduit[] {
  const totaux = new Map<string, number>()
  rows.forEach(r => totaux.set(r.produit, (totaux.get(r.produit) ?? 0) + (r.quantite ?? 0)))
  return [...totaux.entries()]
    .map(([produit, total]) => ({ produit, total }))
    .sort((a, b) => a.produit.localeCompare(b.produit, 'fr'))
}
