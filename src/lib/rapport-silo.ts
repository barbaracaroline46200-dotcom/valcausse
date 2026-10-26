import type { SupabaseClient } from '@supabase/supabase-js'
import { getRapportTransports, type LigneRapport } from './rapport-transports'

export const TYPES_SILO = ['Silo', 'Silo gare'] as const
export type TypeSilo = typeof TYPES_SILO[number]

export interface LigneRapportSilo {
  id: string
  date: string | null
  periodeLabel: string
  dateApproximative: boolean
  /** "AAAA-MM" du mois de livraison (déduit de la date, sinon du mois prévu), ou null si inconnu */
  moisCle: string | null
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

export interface GroupeMois {
  moisCle: string | null
  label: string
  lignes: LigneRapportSilo[]
  total: number
}

function moisCle(date: string | null, moisPrevu: string | null): string | null {
  if (date) return date.slice(0, 7)
  if (moisPrevu) return moisPrevu.slice(0, 7)
  return null
}

function versLigneSilo(l: LigneRapport): LigneRapportSilo | null {
  if (l.silo !== 'Silo' && l.silo !== 'Silo gare') return null
  return {
    id: l.id,
    date: l.date,
    periodeLabel: l.periodeLabel,
    dateApproximative: l.dateApproximative,
    moisCle: moisCle(l.date, l.moisPrevu),
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

export function totauxParProduit(rows: LigneRapportSilo[]): TotalProduit[] {
  const totaux = new Map<string, number>()
  rows.forEach(r => totaux.set(r.produit, (totaux.get(r.produit) ?? 0) + (r.quantite ?? 0)))
  return [...totaux.entries()]
    .map(([produit, total]) => ({ produit, total }))
    .sort((a, b) => a.produit.localeCompare(b.produit, 'fr'))
}

function labelMois(cle: string | null): string {
  if (!cle) return 'Date inconnue'
  const d = new Date(`${cle}-01`)
  const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Regroupe les livraisons par mois (ordre chronologique, mois inconnu en
 *  dernier), triées par date croissante à l'intérieur de chaque mois, avec
 *  le tonnage total du mois. */
export function grouperParMois(rows: LigneRapportSilo[]): GroupeMois[] {
  const groupes = new Map<string, LigneRapportSilo[]>()
  rows.forEach(r => {
    const cle = r.moisCle ?? '9999-99'
    if (!groupes.has(cle)) groupes.set(cle, [])
    groupes.get(cle)!.push(r)
  })
  return [...groupes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cle, lignes]) => {
      const triees = [...lignes].sort((a, b) => (a.date ?? '9999-99-99').localeCompare(b.date ?? '9999-99-99'))
      return {
        moisCle: cle === '9999-99' ? null : cle,
        label: labelMois(cle === '9999-99' ? null : cle),
        lignes: triees,
        total: triees.reduce((s, r) => s + (r.quantite ?? 0), 0),
      }
    })
}
