'use server'

import { getServiceClient } from '@/lib/supabase'
import { getAnneeAgricoleISO } from '@/lib/annee-agricole'

export async function getDashboardData() {
  const supabase = getServiceClient()
  const { debut, fin } = getAnneeAgricoleISO()

  const { data: contrats } = await supabase
    .from('contrats_achat')
    .select('id,famille,statut,quantite_totale,date_debut,date_fin,gere_par_silo,produit:produits(nom),livraisons(type,quantite_reelle)')
    .or(`date_debut.gte.${debut},date_fin.lte.${fin}`)

  const now = new Date()
  const showNextMonth = now.getDate() >= 20
  const nbMoisSup = showNextMonth ? 2 : 1
  const moisFin = new Date(now.getFullYear(), now.getMonth() + nbMoisSup, 0).toISOString().split('T')[0]
  const moisCourant = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const moisSuivant = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0]

  const { data: livraisonsPlanifieesRaw } = await supabase
    .from('livraisons')
    .select(`*,contrat_achat:contrats_achat(numero_contrat,famille,produit:produits(nom),fournisseur:fournisseurs(nom),transporteur:transporteurs(id,nom),contrats_vente(id,agriculteur:agriculteurs(nom,ville_livraison)))`)
    .eq('type', 'planifiee')
    .order('mois_prevu', { ascending: true })

  const livraisonsPlanifiees = (livraisonsPlanifieesRaw ?? []).filter(
    (l: any) => !l.transporteur_contacte && l.mois_prevu && l.mois_prevu.slice(0, 10) <= moisFin
  )

  const cmrSelect = `*,contrat_achat:contrats_achat(id,numero_contrat,famille,prix_transport_prevu,produit:produits(nom),transporteur:transporteurs(id,nom,email,telephone),contrats_vente(id,numero_contrat,quantite,agriculteur:agriculteurs(id,nom,ville_livraison)))`

  const { data: toutesLivraisons } = await supabase
    .from('livraisons')
    .select(cmrSelect)
    .order('date_reelle', { ascending: true })

  const cmrRealisees = (toutesLivraisons ?? []).filter((l: any) => l.type === 'realisee' && !l.numero_lettre_voiture)
  const cmrPlanifiees = (toutesLivraisons ?? []).filter((l: any) => l.type === 'planifiee' && !!l.transporteur_contacte)
  const cmrMap = new Map<string, any>()
  for (const l of [...cmrRealisees, ...cmrPlanifiees]) cmrMap.set(l.id, l)
  const cmrEnAttente = Array.from(cmrMap.values()).sort((a, b) => {
    const da = a.date_prevue || a.date_souhaitee || a.date_reelle || a.mois_prevu || ''
    const db = b.date_prevue || b.date_souhaitee || b.date_reelle || b.mois_prevu || ''
    return da < db ? -1 : da > db ? 1 : 0
  })

  const facturationSelect = `*,contrat_achat:contrats_achat(id,numero_contrat,famille,produit:produits(nom),transporteur:transporteurs(nom),fournisseur:fournisseurs(nom),contrats_vente(id,numero_contrat,destination_silo,agriculteur:agriculteurs(id,civilite,nom)))`
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

  const { data: transporteurs } = await supabase.from('transporteurs').select('*').order('nom')

  return {
    contrats: contrats ?? [],
    livraisonsPlanifiees,
    cmrEnAttente,
    livraisonsAFacturer,
    rfManquants: rfManquants ?? [],
    livraisonsAVerifierClient,
    livraisonsAFacturerClient,
    contratsAlerte: contratsAlerte ?? [],
    annee: { debut, fin },
    moisCourant,
    moisSuivant,
    transporteurs: transporteurs ?? [],
  }
}
