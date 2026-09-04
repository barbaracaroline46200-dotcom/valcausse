import type { SupabaseClient } from '@supabase/supabase-js'
import { reliquat, nomEntite } from './utils'

// NB : les filtres PostgREST sur booléens/dates (is.null, eq.true/false, lte.date)
// sont peu fiables sur Vercel (cf. src/app/api/dashboard/route.ts) — on ne filtre
// ici que sur des colonnes texte/enum côté requête, tout le reste est fait en JS.

const LIVRAISON_SELECT = `
  id, type, mois_prevu, quantite_prevue, quantite_reelle, date_reelle,
  date_prevue, semaine_prevue, date_souhaitee, semaine_souhaitee,
  ville_chargement, ville_destination, destination_silo,
  numero_lettre_voiture, piece_fournisseur_numero,
  transporteur_contacte, agriculteur_contacte, pdf_envoye, solde_ouverture,
  transporteur:transporteurs(id, nom),
  contrat_achat:contrats_achat(
    id, numero_contrat, ville_chargement,
    produit:produits(nom),
    fournisseur:fournisseurs(nom),
    transporteur:transporteurs(id, nom)
  ),
  contrat_vente:contrats_vente(
    id, numero_contrat, destination_silo, silo_nom,
    produit:produits(nom),
    agriculteur:agriculteurs(civilite, nom, ville_livraison)
  )
`

/** Les 5 niveaux d'avancement d'une livraison, alignés sur les 3 étapes de
 *  l'onglet "À organiser" + un 4ᵉ niveau "complet" (document reçu). Le document
 *  reçu prime sur tout le reste : un transport peut être effectué par le
 *  transporteur sans qu'il ait jamais été "confirmé" dans l'outil — ce n'est
 *  qu'un indicateur, ça ne doit rien bloquer. */
export type NiveauLivraison = 'non_demarre' | 'agri_contacte' | 'execution_demandee' | 'confirme' | 'complet'

export const NIVEAUX: { key: NiveauLivraison; label: string; hex: string; rang: number }[] = [
  { key: 'non_demarre', label: 'Non démarré', hex: '#9ca3af', rang: 0 },
  { key: 'agri_contacte', label: 'Agri contacté', hex: '#2563eb', rang: 1 },
  { key: 'execution_demandee', label: 'Exécution demandée', hex: '#ea580c', rang: 2 },
  { key: 'confirme', label: 'Transport confirmé', hex: '#7c3aed', rang: 3 },
  { key: 'complet', label: 'Complet', hex: '#16a34a', rang: 4 },
]
const RANG_NIVEAU: Record<NiveauLivraison, number> = Object.fromEntries(NIVEAUX.map(n => [n.key, n.rang])) as Record<NiveauLivraison, number>

export interface LigneRapport {
  id: string
  type: 'planifiee' | 'realisee'
  date: string | null
  periodeLabel: string
  /** true si aucune date ni semaine précise n'est connue (juste le mois du contrat) */
  dateApproximative: boolean
  quantite: number | null
  produit: string
  numeroContrat: string
  fournisseur: string
  origine: string
  destination: string
  agriculteur: string
  transporteur: string
  niveau: NiveauLivraison
}

export interface LigneNonPlanifiee {
  contratId: string
  numeroContrat: string
  produit: string
  fournisseur: string
  transporteur: string
  agriculteurs: string
  dateFinContrat: string | null
  quantiteRestante: number
}

export interface RapportTransports {
  realisees: LigneRapport[]
  planifiees: LigneRapport[]
  nonPlanifiees: LigneNonPlanifiee[]
}

function inRange(d: string | null | undefined, debut: string, fin: string): boolean {
  if (!d) return false
  const day = d.slice(0, 10)
  return day >= debut && day <= fin
}

function moisChevauchePeriode(moisPrevu: string, debut: string, fin: string): boolean {
  const moisDebut = moisPrevu.slice(0, 10)
  const [y, m] = moisDebut.split('-').map(Number)
  const moisFin = new Date(y, m, 0).toISOString().slice(0, 10)
  return moisDebut <= fin && moisFin >= debut
}

function datePlanifieeConnue(l: any): string | null {
  return l.date_prevue || l.date_souhaitee || null
}

function estRealiseeDansPeriode(l: any, debut: string, fin: string): boolean {
  return l.type === 'realisee' && !l.solde_ouverture && inRange(l.date_reelle, debut, fin)
}

function estPlanifieeDansPeriode(l: any, debut: string, fin: string): boolean {
  if (l.type !== 'planifiee' || l.solde_ouverture) return false
  const d = datePlanifieeConnue(l)
  if (d) return inRange(d, debut, fin)
  if (l.mois_prevu) return moisChevauchePeriode(l.mois_prevu, debut, fin)
  return false
}

// Silo (hors silo-gare) : pas de CMR requis, seulement le BA (piece_fournisseur_numero)
function estSiloSansGare(l: any): boolean {
  const cv = l.contrat_vente
  const estSilo = l.destination_silo || cv?.destination_silo
  if (!estSilo) return false
  return !(cv?.silo_nom ?? '').toLowerCase().includes('gare')
}

// Le document (CMR, ou BA pour une livraison silo hors gare) est-il renseigné ?
// Indépendant du type : une livraison encore "planifiee" pourrait en théorie déjà
// l'avoir (saisie en avance), et une "realisee" peut très bien ne pas l'avoir.
function documentRecu(l: any): boolean {
  if (estSiloSansGare(l)) return !!l.piece_fournisseur_numero
  return !!l.numero_lettre_voiture
}

function niveauLivraison(l: any): NiveauLivraison {
  if (documentRecu(l)) return 'complet'
  if (l.transporteur_contacte) return 'confirme'
  if (l.pdf_envoye) return 'execution_demandee'
  if (l.agriculteur_contacte || l.date_souhaitee || l.semaine_souhaitee) return 'agri_contacte'
  return 'non_demarre'
}

function getProduitNom(l: any): string {
  return l.contrat_achat?.produit?.nom ?? l.contrat_vente?.produit?.nom ?? '—'
}

function getNumeroContrat(l: any): string {
  const a = l.contrat_achat?.numero_contrat
  const v = l.contrat_vente?.numero_contrat
  if (a && v) return `${a} / ${v}`
  return a || v || '—'
}

function getFournisseurNom(l: any): string {
  return l.contrat_achat?.fournisseur?.nom ?? 'Vente départ silo'
}

function getTransporteurNom(l: any): string {
  return l.transporteur?.nom ?? l.contrat_achat?.transporteur?.nom ?? '—'
}

function getVilleOrigine(l: any): string {
  return l.ville_chargement || l.contrat_achat?.ville_chargement || '—'
}

function getAgriculteurNom(l: any): string {
  const cv = l.contrat_vente
  if (l.destination_silo || cv?.destination_silo) return cv?.silo_nom || 'Silo'
  if (cv?.agriculteur) return nomEntite(cv.agriculteur)
  return '—'
}

function getVilleDestination(l: any): string {
  if (l.ville_destination) return l.ville_destination
  const cv = l.contrat_vente
  if (l.destination_silo || cv?.destination_silo) return cv?.silo_nom || 'Silo'
  return cv?.agriculteur?.ville_livraison || '—'
}

function periodeLabel(l: any): string {
  if (l.semaine_prevue) return `Sem. ${l.semaine_prevue}`
  if (l.semaine_souhaitee) return `Sem. ${l.semaine_souhaitee}`
  if (l.mois_prevu) {
    const d = new Date(l.mois_prevu)
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }
  return '—'
}

function mapRow(l: any): LigneRapport {
  const date = l.type === 'realisee' ? (l.date_reelle ?? null) : datePlanifieeConnue(l)
  const semaine = l.semaine_prevue || l.semaine_souhaitee || null
  return {
    id: l.id,
    type: l.type,
    date,
    periodeLabel: date ? '' : periodeLabel(l),
    dateApproximative: l.type === 'planifiee' && !date && !semaine,
    quantite: l.type === 'realisee' ? (l.quantite_reelle ?? null) : (l.quantite_prevue ?? null),
    produit: getProduitNom(l),
    numeroContrat: getNumeroContrat(l),
    fournisseur: getFournisseurNom(l),
    origine: getVilleOrigine(l),
    destination: getVilleDestination(l),
    agriculteur: getAgriculteurNom(l),
    transporteur: getTransporteurNom(l),
    niveau: niveauLivraison(l),
  }
}

function parAncienneteCroissante(a: { date: string | null }, b: { date: string | null }) {
  return (a.date ?? '9999-99-99').localeCompare(b.date ?? '9999-99-99')
}

export type TriChamp = 'date' | 'agriculteur' | 'contrat' | 'fournisseur' | 'statut'
export type Ordre = 'asc' | 'desc'

export function trierLignes(rows: LigneRapport[], tri: TriChamp, ordre: Ordre = 'asc'): LigneRapport[] {
  const sorted = [...rows].sort((a, b) => {
    let cmp = 0
    switch (tri) {
      case 'agriculteur': cmp = a.agriculteur.localeCompare(b.agriculteur, 'fr'); break
      case 'contrat': cmp = a.numeroContrat.localeCompare(b.numeroContrat, 'fr'); break
      case 'fournisseur': cmp = a.fournisseur.localeCompare(b.fournisseur, 'fr'); break
      case 'statut': cmp = RANG_NIVEAU[a.niveau] - RANG_NIVEAU[b.niveau]; break
      case 'date':
      default: cmp = (a.date ?? '9999-99-99').localeCompare(b.date ?? '9999-99-99')
    }
    return ordre === 'desc' ? -cmp : cmp
  })
  return sorted
}

export interface FiltresRapport {
  fournisseur?: string
  agriculteur?: string
  contrat?: string
  produit?: string
  statut?: NiveauLivraison | ''
}

export function filtrerLignes(rows: LigneRapport[], f: FiltresRapport): LigneRapport[] {
  return rows.filter(r => {
    if (f.fournisseur && r.fournisseur !== f.fournisseur) return false
    if (f.agriculteur && r.agriculteur !== f.agriculteur) return false
    if (f.contrat && !r.numeroContrat.toLowerCase().includes(f.contrat.toLowerCase())) return false
    if (f.produit && r.produit !== f.produit) return false
    if (f.statut && r.niveau !== f.statut) return false
    return true
  })
}

export function filtrerNonPlanifiees(rows: LigneNonPlanifiee[], f: FiltresRapport): LigneNonPlanifiee[] {
  return rows.filter(r => {
    if (f.fournisseur && r.fournisseur !== f.fournisseur) return false
    if (f.agriculteur && !r.agriculteurs.toLowerCase().includes(f.agriculteur.toLowerCase())) return false
    if (f.contrat && !r.numeroContrat.toLowerCase().includes(f.contrat.toLowerCase())) return false
    if (f.produit && r.produit !== f.produit) return false
    return true
  })
}

/** Contrats dont la date de fin tombe dans/avant la période demandée, avec du
 *  reliquat restant, et pour lesquels aucun transport (planifié ou réalisé)
 *  n'est positionné sur la période — c'est-à-dire des transports qui auraient
 *  dû être organisés pour ces dates mais ne le sont pas. */
async function getContratsNonPlanifies(
  supabase: SupabaseClient,
  dateDebut: string,
  dateFin: string
): Promise<LigneNonPlanifiee[]> {
  const contratSelect = `
    id, numero_contrat, date_fin, quantite_totale, gere_par_silo,
    produit:produits(nom),
    fournisseur:fournisseurs(nom),
    transporteur:transporteurs(nom),
    livraisons(type, quantite_reelle, date_reelle, mois_prevu, date_prevue, date_souhaitee, solde_ouverture),
    contrats_vente(id, agriculteur:agriculteurs(civilite, nom))
  `
  const { data: contratsAchatRaw } = await supabase
    .from('contrats_achat')
    .select(contratSelect)
    .eq('statut', 'en_cours')

  const nonPlanifieesAchat: LigneNonPlanifiee[] = (contratsAchatRaw ?? [])
    .filter((c: any) => !c.gere_par_silo && c.date_fin && c.date_fin.slice(0, 10) <= dateFin)
    .filter((c: any) => reliquat(Number(c.quantite_totale) || 0, c.livraisons ?? []) > 0)
    .filter((c: any) => !(c.livraisons ?? []).some(
      (l: any) => estRealiseeDansPeriode(l, dateDebut, dateFin) || estPlanifieeDansPeriode(l, dateDebut, dateFin)
    ))
    .map((c: any) => ({
      contratId: c.id,
      numeroContrat: c.numero_contrat,
      produit: c.produit?.nom ?? '—',
      fournisseur: c.fournisseur?.nom ?? '—',
      transporteur: c.transporteur?.nom ?? '—',
      agriculteurs: (c.contrats_vente ?? [])
        .map((v: any) => nomEntite(v.agriculteur))
        .filter((n: string) => n !== '—')
        .join(', ') || '—',
      dateFinContrat: c.date_fin,
      quantiteRestante: reliquat(Number(c.quantite_totale) || 0, c.livraisons ?? []),
    }))

  const contratVenteSelect = `
    id, numero_contrat, date_fin, quantite, destination_silo, silo_nom, contrat_achat_id,
    produit:produits(nom),
    agriculteur:agriculteurs(civilite, nom),
    livraisons(type, quantite_reelle, date_reelle, mois_prevu, date_prevue, date_souhaitee, solde_ouverture)
  `
  const { data: contratsVenteRaw } = await supabase
    .from('contrats_vente')
    .select(contratVenteSelect)
    .eq('statut', 'en_cours')

  // Uniquement les ventes départ silo (sans contrat d'achat) : les autres sont
  // déjà couvertes par leur contrat d'achat ci-dessus.
  const nonPlanifieesVente: LigneNonPlanifiee[] = (contratsVenteRaw ?? [])
    .filter((c: any) => !c.contrat_achat_id)
    .filter((c: any) => c.date_fin && c.date_fin.slice(0, 10) <= dateFin)
    .filter((c: any) => reliquat(Number(c.quantite) || 0, c.livraisons ?? []) > 0)
    .filter((c: any) => !(c.livraisons ?? []).some(
      (l: any) => estRealiseeDansPeriode(l, dateDebut, dateFin) || estPlanifieeDansPeriode(l, dateDebut, dateFin)
    ))
    .map((c: any) => ({
      contratId: c.id,
      numeroContrat: c.numero_contrat,
      produit: c.produit?.nom ?? '—',
      fournisseur: 'Vente départ silo',
      transporteur: '—',
      agriculteurs: c.destination_silo ? (c.silo_nom || 'Silo') : nomEntite(c.agriculteur),
      dateFinContrat: c.date_fin,
      quantiteRestante: reliquat(Number(c.quantite) || 0, c.livraisons ?? []),
    }))

  return [...nonPlanifieesAchat, ...nonPlanifieesVente].sort(
    (a, b) => (a.dateFinContrat ?? '9999-99-99').localeCompare(b.dateFinContrat ?? '9999-99-99')
  )
}

export async function getRapportTransports(
  supabase: SupabaseClient,
  dateDebut: string,
  dateFin: string
): Promise<RapportTransports> {
  const { data: toutesLivraisonsRaw } = await supabase
    .from('livraisons')
    .select(LIVRAISON_SELECT)

  const toutesLivraisons = toutesLivraisonsRaw ?? []

  const realisees = (toutesLivraisons as any[])
    .filter(l => estRealiseeDansPeriode(l, dateDebut, dateFin))
    .map(mapRow)
    .sort(parAncienneteCroissante)

  const planifiees = (toutesLivraisons as any[])
    .filter(l => estPlanifieeDansPeriode(l, dateDebut, dateFin))
    .map(mapRow)
    .sort(parAncienneteCroissante)

  const nonPlanifiees = await getContratsNonPlanifies(supabase, dateDebut, dateFin)

  return { realisees, planifiees, nonPlanifiees }
}
