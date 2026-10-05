'use server'

import { getServiceClient } from '@/lib/supabase'
import { getAnneeAgricoleISO } from '@/lib/annee-agricole'
import { reliquat } from '@/lib/utils'

export async function getDashboardData() {
  const supabase = getServiceClient()
  const { debut, fin } = getAnneeAgricoleISO()

  const { data: contrats } = await supabase
    .from('contrats_achat')
    .select('id,numero_contrat,famille,statut,quantite_totale,date_debut,date_fin,gere_par_silo,produit:produits(nom),fournisseur:fournisseurs(nom),livraisons(type,quantite_reelle),contrats_vente(quantite)')
    .or(`date_debut.gte.${debut},date_fin.lte.${fin}`)

  const now = new Date()
  const showNextMonth = now.getDate() >= 20
  const nbMoisSup = showNextMonth ? 2 : 1
  const moisFin = new Date(now.getFullYear(), now.getMonth() + nbMoisSup, 0).toISOString().split('T')[0]
  const moisCourant = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const moisSuivant = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0]

  const { data: livraisonsPlanifieesRaw } = await supabase
    .from('livraisons')
    .select(`*,contrat_achat:contrats_achat(id,numero_contrat,famille,produit:produits(nom),fournisseur:fournisseurs(nom),transporteur:transporteurs(id,nom),contrats_vente(id,agriculteur:agriculteurs(nom,ville_livraison)))`)
    .eq('type', 'planifiee')
    .order('mois_prevu', { ascending: true })

  const livraisonsPlanifiees = (livraisonsPlanifieesRaw ?? []).filter(
    (l: any) => !l.transporteur_contacte && l.mois_prevu && l.mois_prevu.slice(0, 10) <= moisFin
  )

  const facturationSelect = `*,contrat_achat:contrats_achat(id,numero_contrat,famille,prix_achat,produit:produits(nom),transporteur:transporteurs(nom),fournisseur:fournisseurs(nom),contrats_vente(id,numero_contrat,destination_silo,agriculteur:agriculteurs(id,civilite,nom)))`
  const { data: livraisonsAFacturerRaw } = await supabase
    .from('livraisons')
    .select(facturationSelect)
    .order('date_reelle', { ascending: false })
  const livraisonsAFacturer = (livraisonsAFacturerRaw ?? []).filter(
    (l: any) => l.type === 'realisee' && (!l.transport_facture || !l.facture_fournisseur_id)
  )

  // Livraisons réalisées non-silo pour facturation client
  const livraisonsClientRaw = (livraisonsAFacturerRaw ?? []).filter((l: any) => {
    if (l.type !== 'realisee') return false
    const cv = l.contrat_achat?.contrats_vente?.find((v: any) => v.id === l.contrat_vente_id)
    return cv && !cv.destination_silo
  })
  const livraisonsAVerifierClient = livraisonsClientRaw.filter((l: any) => !l.verifie_client && !l.facture_client_saisie)
  const livraisonsAFacturerClient = livraisonsClientRaw.filter((l: any) => l.verifie_client && !l.facture_client_saisie)

  const { data: rfManquants } = await supabase
    .from('factures_fournisseur')
    .select(`*,contrat_achat:contrats_achat(id,numero_contrat,famille,produit:produits(nom),fournisseur:fournisseurs(nom))`)
    .is('numero_piece_logiciel', null)
    .not('numero_facture', 'is', null)
    .order('date_facture', { ascending: false })

  const dans30j = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: contratsAlerte } = await supabase
    .from('contrats_achat')
    .select('*,produit:produits(nom),fournisseur:fournisseurs(nom),livraisons(type,quantite_reelle),contrats_vente(id,quantite,agriculteur:agriculteurs(nom))')
    .eq('statut', 'en_cours')
    .lte('date_fin', dans30j)

  // Ventes avec reliquat non livré dont le(s) contrat(s) d'achat lié(s) sont tous clos :
  // la source d'approvisionnement qui devait couvrir le reste à livrer s'est tarie avant
  // d'avoir tout fourni — à repérer pour trouver la marchandise ailleurs. Une vente sans
  // aucun lien n'est volontairement pas concernée : c'est le cas normal d'une vente directe
  // départ silo, gérée sans contrat d'achat par conception, pas une source qui a disparu.
  const { data: ventesSourceRaw } = await supabase
    .from('contrats_vente')
    .select('id,numero_contrat,quantite,destination_silo,agriculteur:agriculteurs(nom),produit:produits(nom),livraisons(type,quantite_reelle),liens:contrats_vente_liens(contrat_achat:contrats_achat(id,numero_contrat,statut))')
    .eq('statut', 'en_cours')
    .eq('destination_silo', false)

  const ventesSansSource = (ventesSourceRaw ?? [])
    .filter((v: any) => {
      if (reliquat(v.quantite ?? 0, v.livraisons ?? []) <= 0.01) return false
      const liens = v.liens ?? []
      if (liens.length === 0) return false
      return liens.every((l: any) => l.contrat_achat?.statut === 'clos')
    })
    .map((v: any) => ({ ...v, reliquat: reliquat(v.quantite ?? 0, v.livraisons ?? []) }))

  const { data: transporteurs } = await supabase.from('transporteurs').select('*').order('nom')

  // Contrats sans prix d'achat défini — à fixer avant leur date de début
  const { data: contratsPrixRaw } = await supabase
    .from('contrats_achat')
    .select('id,numero_contrat,famille,date_debut,quantite_totale,prix_achat,produit:produits(nom),fournisseur:fournisseurs(nom)')
    .eq('statut', 'en_cours')
  const contratsSansPrix = (contratsPrixRaw ?? [])
    .filter((c: any) => c.prix_achat == null)
    .sort((a: any, b: any) => (a.date_debut ?? '9999-99-99').localeCompare(b.date_debut ?? '9999-99-99'))

  return {
    contrats: contrats ?? [],
    livraisonsPlanifiees,
    livraisonsAFacturer,
    rfManquants: rfManquants ?? [],
    livraisonsAVerifierClient,
    livraisonsAFacturerClient,
    contratsAlerte: contratsAlerte ?? [],
    contratsSansPrix,
    ventesSansSource,
    annee: { debut, fin },
    moisCourant,
    moisSuivant,
    transporteurs: transporteurs ?? [],
  }
}
