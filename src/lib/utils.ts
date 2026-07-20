import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function reliquat(quantiteTotale: number, livraisons: Array<{ quantite_reelle?: number | null; type: string }>): number {
  const livre = livraisons
    .filter(l => l.type === 'realisee' && l.quantite_reelle != null)
    .reduce((sum, l) => sum + (l.quantite_reelle ?? 0), 0)
  return Math.max(0, quantiteTotale - livre)
}

export function quantiteLivree(livraisons: Array<{ quantite_reelle?: number | null; type: string }>): number {
  return livraisons
    .filter(l => l.type === 'realisee' && l.quantite_reelle != null)
    .reduce((sum, l) => sum + (l.quantite_reelle ?? 0), 0)
}

// montantReel et prixPrev sont tous les deux des prix par tonne (pas des montants totaux)
export function ecartTransport(montantReel?: number | null, prixPrev?: number | null): number | null {
  if (montantReel == null || prixPrev == null) return null
  return montantReel - prixPrev
}

export function joursDepuis(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

/** Affiche la civilité + nom d'une entité (agriculteur, fournisseur, transporteur…).
 *  Ex: "GAEC LES AYGUES", "SAS DUPUY", "JD Transport" */
export function nomEntite(a: { nom?: string | null; civilite?: string | null } | null | undefined): string {
  if (!a) return '—'
  const parts = [a.civilite, a.nom].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : '—'
}

/** Alias pour rétrocompatibilité */
export const nomAgri = nomEntite
