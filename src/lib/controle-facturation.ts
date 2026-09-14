import type { SupabaseClient } from '@supabase/supabase-js'

// NB : comme pour rapport-transports.ts, on évite de filtrer côté requête
// PostgREST sur des colonnes date/booléen (peu fiable sur Vercel) — on
// récupère toutes les livraisons réalisées avec contrat d'achat et on filtre
// la période ainsi que le statut entièrement en JS.

const LIVRAISON_SELECT = `
  id, contrat_achat_id, date_reelle, quantite_reelle,
  contrat_achat:contrats_achat(
    id, numero_contrat,
    produit:produits(nom),
    fournisseur:fournisseurs(nom)
  ),
  facture_fournisseur:factures_fournisseur!livraisons_facture_fournisseur_id_fkey(
    id, numero_facture, date_facture
  )
`

/** Les 4 statuts de contrôle d'une livraison réalisée vis-à-vis de sa facture
 *  fournisseur. Le cas qui intéresse la compta est "mois_different" : la
 *  livraison et la facture ne tombent pas dans le même mois calendaire
 *  (ex. livré en juin, facturé en juillet). */
export type StatutFacturation = 'non_facturee' | 'facture_sans_date' | 'meme_mois' | 'mois_different'

export const STATUTS: { key: StatutFacturation; label: string; hex: string; rang: number }[] = [
  { key: 'meme_mois', label: 'Même mois', hex: '#16a34a', rang: 0 },
  { key: 'non_facturee', label: 'Pas encore facturée', hex: '#9ca3af', rang: 1 },
  { key: 'facture_sans_date', label: 'Date facture manquante', hex: '#d97706', rang: 2 },
  { key: 'mois_different', label: 'Mois différent', hex: '#dc2626', rang: 3 },
]
const RANG_STATUT: Record<StatutFacturation, number> = Object.fromEntries(STATUTS.map(s => [s.key, s.rang])) as Record<StatutFacturation, number>

export interface LigneControle {
  id: string
  dateLivraison: string
  quantite: number | null
  produit: string
  numeroContrat: string
  contratId: string | null
  fournisseur: string
  numeroFacture: string | null
  dateFacture: string | null
  /** (mois facture) - (mois livraison), en mois calendaires. null si non calculable. */
  ecartMois: number | null
  statut: StatutFacturation
}

function inRange(d: string | null | undefined, debut: string, fin: string): boolean {
  if (!d) return false
  const day = d.slice(0, 10)
  return day >= debut && day <= fin
}

function ecartEnMois(dateLivraison: string, dateFacture: string): number {
  const l = new Date(dateLivraison)
  const f = new Date(dateFacture)
  return (f.getFullYear() * 12 + f.getMonth()) - (l.getFullYear() * 12 + l.getMonth())
}

function mapRow(l: any): LigneControle {
  const ca = l.contrat_achat
  // Le hint !livraisons_facture_fournisseur_id_fkey renvoie un objet unique
  // (parfois un tableau à 1 élément selon la version du client) — on normalise.
  const ff = Array.isArray(l.facture_fournisseur) ? l.facture_fournisseur[0] : l.facture_fournisseur
  const dateFacture: string | null = ff?.date_facture ?? null

  let statut: StatutFacturation
  let ecartMois: number | null = null
  if (!ff) {
    statut = 'non_facturee'
  } else if (!dateFacture) {
    statut = 'facture_sans_date'
  } else {
    ecartMois = ecartEnMois(l.date_reelle, dateFacture)
    statut = ecartMois === 0 ? 'meme_mois' : 'mois_different'
  }

  return {
    id: l.id,
    dateLivraison: l.date_reelle,
    quantite: l.quantite_reelle ?? null,
    produit: ca?.produit?.nom ?? '—',
    numeroContrat: ca?.numero_contrat ?? '—',
    contratId: ca?.id ?? null,
    fournisseur: ca?.fournisseur?.nom ?? '—',
    numeroFacture: ff?.numero_facture ?? null,
    dateFacture,
    ecartMois,
    statut,
  }
}

export async function getControleFacturation(
  supabase: SupabaseClient,
  dateDebut: string,
  dateFin: string
): Promise<LigneControle[]> {
  const { data } = await supabase
    .from('livraisons')
    .select(LIVRAISON_SELECT)
    .eq('type', 'realisee')

  return ((data ?? []) as any[])
    .filter(l => l.contrat_achat_id && inRange(l.date_reelle, dateDebut, dateFin))
    .map(mapRow)
    .sort((a, b) => (a.dateLivraison ?? '9999-99-99').localeCompare(b.dateLivraison ?? '9999-99-99'))
}

export type TriChamp = 'date' | 'fournisseur' | 'contrat' | 'produit' | 'ecart'
export type Ordre = 'asc' | 'desc'

export function trierLignes(rows: LigneControle[], tri: TriChamp, ordre: Ordre = 'asc'): LigneControle[] {
  const sorted = [...rows].sort((a, b) => {
    let cmp = 0
    switch (tri) {
      case 'fournisseur': cmp = a.fournisseur.localeCompare(b.fournisseur, 'fr'); break
      case 'contrat': cmp = a.numeroContrat.localeCompare(b.numeroContrat, 'fr'); break
      case 'produit': cmp = a.produit.localeCompare(b.produit, 'fr'); break
      case 'ecart': cmp = (a.ecartMois ?? -999) - (b.ecartMois ?? -999) || RANG_STATUT[a.statut] - RANG_STATUT[b.statut]; break
      case 'date':
      default: cmp = (a.dateLivraison ?? '9999-99-99').localeCompare(b.dateLivraison ?? '9999-99-99')
    }
    return ordre === 'desc' ? -cmp : cmp
  })
  return sorted
}

export interface FiltresControle {
  fournisseur?: string
  produit?: string
  contrat?: string
  statut?: StatutFacturation | ''
}

export function filtrerLignes(rows: LigneControle[], f: FiltresControle): LigneControle[] {
  return rows.filter(r => {
    if (f.fournisseur && r.fournisseur !== f.fournisseur) return false
    if (f.produit && r.produit !== f.produit) return false
    if (f.contrat && !r.numeroContrat.toLowerCase().includes(f.contrat.toLowerCase())) return false
    if (f.statut && r.statut !== f.statut) return false
    return true
  })
}
