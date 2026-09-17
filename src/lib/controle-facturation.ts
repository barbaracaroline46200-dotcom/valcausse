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
    // Livraisons de juin 2026 jamais facturées : artefacts de la mise en place initiale
    // du logiciel (pas de vraies livraisons en attente de facture) — exclues de ce
    // contrôle uniquement, sans toucher aux livraisons ni aux contrats eux-mêmes.
    .filter(l => !(l.statut === 'non_facturee' && l.dateLivraison?.slice(0, 7) === '2026-06'))
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

/** Prix par défaut utilisé pour estimer une livraison planifiée dont le contrat
 *  n'a pas encore de prix d'achat fixé (contrat en cours de négociation). */
export const PRIX_PAR_DEFAUT = 30

/** 'retard' : planifiée, date dépassée (peut se réaliser à tout moment — ex. pénurie).
 *  'a_venir' : planifiée, pas encore due.
 *  'livre_non_facture' : déjà réalisée, mais la facture fournisseur n'est pas encore arrivée. */
export type StatutPrevisionnel = 'retard' | 'a_venir' | 'livre_non_facture'

interface LivraisonValorisee {
  id: string
  type: 'planifiee' | 'realisee'
  dateRef: string
  quantite: number
  produit: string
  numeroContrat: string
  contratId: string | null
  fournisseur: string
  prixUnitaireEstime: number
  prixEstimeParDefaut: boolean
  montantEstime: number
  facture: boolean
  statutPlanifiee: 'retard' | 'a_venir' | null
}

/** Charge et valorise toutes les livraisons ayant un contrat d'achat (planifiées
 *  ET réalisées), au prix du contrat + MBM si applicable, ou à un prix par
 *  défaut de 30€/t si le contrat n'a pas encore de prix fixé. Base commune au
 *  prévisionnel et à la vue par période — reprend le calcul de majoration de
 *  l'API dashboard. */
async function chargerLivraisonsValorisees(supabase: SupabaseClient): Promise<LivraisonValorisee[]> {
  const { data: majorationsRaw } = await supabase
    .from('majorations_negoce')
    .select('produit_id,date_debut,valeur')
    .order('date_debut', { ascending: true })
  const majorationsParProduit = new Map<string, { date_debut: string; valeur: number }[]>()
  for (const m of (majorationsRaw ?? []) as any[]) {
    const arr = majorationsParProduit.get(m.produit_id) ?? []
    arr.push({ date_debut: m.date_debut, valeur: Number(m.valeur) })
    majorationsParProduit.set(m.produit_id, arr)
  }
  function calcMajoration(ca: any, dateRef: string | null): number {
    if (!ca?.mbm_autorise || ca.famille !== 'negoce' || !dateRef) return 0
    const paliers = majorationsParProduit.get(ca.produit_id)
    if (!paliers) return 0
    let valeur = 0
    for (const p of paliers) {
      if (p.date_debut > dateRef) break
      valeur = p.valeur
    }
    return valeur
  }

  const { data } = await supabase
    .from('livraisons')
    .select(`
      id, type, mois_prevu, date_prevue, date_reelle, quantite_prevue, quantite_reelle,
      contrat_achat_id, facture_fournisseur_id,
      contrat_achat:contrats_achat(
        id, numero_contrat, famille, prix_achat, mbm_autorise, produit_id,
        produit:produits(nom),
        fournisseur:fournisseurs(nom)
      )
    `)
    // Pas de filtre type ici : planifiées ET réalisées, triées ensuite en JS.

  const maintenant = new Date()
  const aujourdhui = maintenant.toISOString().slice(0, 10)
  // Construit en local (jamais via new Date(y,m,1).toISOString(), qui recule
  // d'un jour aux fuseaux en avance sur UTC comme la France).
  const debutMoisCourant = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}-01`

  return ((data ?? []) as any[])
    .filter(l => l.contrat_achat_id)
    .map(l => {
      const ca = l.contrat_achat
      const estRealisee = l.type === 'realisee'
      const dateRef: string = estRealisee ? l.date_reelle : (l.date_prevue ?? l.mois_prevu)
      const quantite = (estRealisee ? l.quantite_reelle : l.quantite_prevue) ?? 0
      const prixEstimeParDefaut = ca?.prix_achat == null
      const prixBase = ca?.prix_achat ?? PRIX_PAR_DEFAUT
      const majoration = calcMajoration(ca, dateRef)
      const prixUnitaireEstime = prixBase + majoration
      // Retard (planifiée uniquement) : jour précis dépassé si connu (date_prevue),
      // sinon mois entier déjà écoulé — mois_prevu est toujours stocké au 1er du
      // mois, donc le comparer au jour près signalerait à tort tout le mois en
      // cours comme "en retard".
      const statutPlanifiee: 'retard' | 'a_venir' | null = estRealisee
        ? null
        : (l.date_prevue ? l.date_prevue < aujourdhui : l.mois_prevu < debutMoisCourant) ? 'retard' : 'a_venir'
      return {
        id: l.id,
        type: l.type,
        dateRef,
        quantite,
        produit: ca?.produit?.nom ?? '—',
        numeroContrat: ca?.numero_contrat ?? '—',
        contratId: ca?.id ?? null,
        fournisseur: ca?.fournisseur?.nom ?? '—',
        prixUnitaireEstime,
        prixEstimeParDefaut,
        montantEstime: quantite * prixUnitaireEstime,
        facture: !!l.facture_fournisseur_id,
        statutPlanifiee,
      }
    })
}

export interface LignePrevisionnelle {
  id: string
  dateRef: string
  quantite: number
  produit: string
  numeroContrat: string
  contratId: string | null
  fournisseur: string
  prixUnitaireEstime: number
  prixEstimeParDefaut: boolean
  montantEstime: number
  statut: StatutPrevisionnel
}

/** Estimation du montant fournisseur encore à venir : tout ce qui n'est pas
 *  encore facturé — livraisons planifiées (retard compris, quelle que soit son
 *  ancienneté : une livraison en retard peut se réaliser à tout moment) jusqu'à
 *  `dateFin` incluse, ainsi que les livraisons déjà réalisées mais pas encore
 *  facturées (celles-ci sortent du prévisionnel uniquement quand la facture est
 *  traitée, pas quand la livraison a lieu). */
export async function getPrevisionnelFournisseur(supabase: SupabaseClient, dateFin: string): Promise<LignePrevisionnelle[]> {
  const rows = await chargerLivraisonsValorisees(supabase)
  return rows
    // Seule une facture déjà traitée fait sortir une livraison du prévisionnel —
    // qu'elle soit encore planifiée ou déjà réalisée n'entre pas en ligne de compte.
    .filter(l => !l.facture)
    .map(({ statutPlanifiee, facture, type, ...l }) => ({
      ...l,
      statut: (statutPlanifiee ?? 'livre_non_facture') as StatutPrevisionnel,
    }))
    // Pas de borne basse : le retard et le réalisé-non-facturé doivent remonter
    // quelle que soit leur ancienneté, tant qu'ils restent avant dateFin (déjà
    // acquis pour le réalisé, puisque date_reelle est toujours dans le passé).
    .filter(l => l.dateRef <= dateFin)
    .sort((a, b) => a.dateRef.localeCompare(b.dateRef))
}

export interface LignePeriode {
  id: string
  type: 'planifiee' | 'realisee'
  dateRef: string
  quantite: number
  produit: string
  numeroContrat: string
  contratId: string | null
  fournisseur: string
  prixUnitaireEstime: number
  prixEstimeParDefaut: boolean
  montantEstime: number
  facture: boolean
}

/** Toutes les livraisons (planifiées et réalisées, facturées ou non) dont la
 *  date de référence tombe dans [dateDebut, dateFin] — une photo de ce qui est
 *  prévu/arrivé sur une tranche précise (ex. "tout octobre"), sans notion de
 *  retard ni de borne basse ouverte : contrairement au prévisionnel, une
 *  livraison en retard de juillet n'apparaît pas ici si on choisit octobre. */
export async function getLivraisonsParPeriode(supabase: SupabaseClient, dateDebut: string, dateFin: string): Promise<LignePeriode[]> {
  const rows = await chargerLivraisonsValorisees(supabase)
  return rows
    .filter(l => l.dateRef >= dateDebut && l.dateRef <= dateFin)
    .map(({ statutPlanifiee, ...l }) => l)
    .sort((a, b) => a.dateRef.localeCompare(b.dateRef))
}
