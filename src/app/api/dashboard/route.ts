import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { getAnneeAgricoleISO } from '@/lib/annee-agricole'

export async function GET() {
  const supabase = getServiceClient()
  const { debut, fin } = getAnneeAgricoleISO()

  // Contrats de l'année agricole
  const { data: contrats } = await supabase
    .from('contrats_achat')
    .select('id,famille,statut,quantite_totale,produit:produits(nom),livraisons(type,quantite_reelle)')
    .or(`date_debut.gte.${debut},date_fin.lte.${fin}`)

  // Livraisons planifiées à traiter :
  // - tous les mois passés non encore livrés (retard)
  // - le mois en cours
  // - à partir du 20 du mois : le mois prochain aussi
  const now = new Date()
  const showNextMonth = now.getDate() >= 20
  const nbMoisSup = showNextMonth ? 2 : 1
  const moisFin = new Date(now.getFullYear(), now.getMonth() + nbMoisSup, 0).toISOString().split('T')[0]
  const moisCourant = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const moisSuivant = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0]

  const { data: livraisonsPlanifiees } = await supabase
    .from('livraisons')
    .select(`
      *,
      contrat_achat:contrats_achat(
        numero_contrat,famille,
        produit:produits(nom),
        fournisseur:fournisseurs(nom),
        transporteur:transporteurs(id,nom),
        contrats_vente(id,agriculteur:agriculteurs(nom,ville_livraison))
      )
    `)
    .eq('type', 'planifiee')
    .is('date_prevue', null)
    .is('semaine_prevue', null)
    .lte('mois_prevu', moisFin)
    .order('mois_prevu', { ascending: true })

  // CMR en attente :
  // 1. Réalisées depuis > 14j sans lettre de voiture
  // 2. Planifiées dont la date_prevue est dépassée (livraison probable, CMR à récupérer)
  const cutoff14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const today = now.toISOString().split('T')[0]

  const cmrSelect = `
    *,
    contrat_achat:contrats_achat(
      id, numero_contrat, famille, prix_transport_prevu,
      produit:produits(nom),
      transporteur:transporteurs(id,nom,email,telephone),
      contrats_vente(id, numero_contrat, quantite, agriculteur:agriculteurs(id,nom,ville_livraison))
    )
  `

  const { data: cmrRealisees } = await supabase
    .from('livraisons')
    .select(cmrSelect)
    .eq('type', 'realisee')
    .is('numero_lettre_voiture', null)

  // Planifiées avec date_prevue renseignée (transporteur confirmé, en attente de CMR)
  const { data: cmrPlanifieesAvecDate } = await supabase
    .from('livraisons')
    .select(cmrSelect)
    .eq('type', 'planifiee')
    .not('date_prevue', 'is', null)

  // Planifiées avec semaine_prevue renseignée (transporteur confirmé, en attente de CMR)
  const { data: cmrPlanifieesAvecSemaine } = await supabase
    .from('livraisons')
    .select(cmrSelect)
    .eq('type', 'planifiee')
    .not('semaine_prevue', 'is', null)
    .is('date_prevue', null)

  const cmrEnAttente = [
    ...(cmrRealisees ?? []),
    ...(cmrPlanifieesAvecDate ?? []),
    ...(cmrPlanifieesAvecSemaine ?? []),
  ]

  // Facturation en attente : réalisées sans facture transport ou fournisseur
  const facturationSelect = `
    *,
    contrat_achat:contrats_achat(
      id, numero_contrat, famille,
      produit:produits(nom),
      transporteur:transporteurs(nom),
      fournisseur:fournisseurs(nom),
      contrats_vente(id, numero_contrat, agriculteur:agriculteurs(nom))
    )
  `
  const { data: livraisonsAFacturer } = await supabase
    .from('livraisons')
    .select(facturationSelect)
    .eq('type', 'realisee')
    .or('transport_facture.eq.false,facture_fournisseur_id.is.null')
    .order('date_reelle', { ascending: false })

  // RF à récupérer : factures fournisseur sans numéro RF (numero_piece_logiciel null)
  const { data: rfManquants } = await supabase
    .from('factures_fournisseur')
    .select(`
      *,
      contrat_achat:contrats_achat(id, numero_contrat, famille, produit:produits(nom), fournisseur:fournisseurs(nom))
    `)
    .is('numero_piece_logiciel', null)
    .not('numero_facture', 'is', null)
    .order('date_facture', { ascending: false })

  // Factures clients à récupérer :
  // Contrats de vente dont toutes les livraisons sont réalisées
  // ET la dernière livraison date de plus de 30 jours
  // ET pas encore de facture client saisie
  const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: contratsAvecVentes } = await supabase
    .from('contrats_achat')
    .select(`
      id, numero_contrat,
      produit:produits(nom),
      contrats_vente(id, numero_contrat, agriculteur:agriculteurs(nom), factures_client(id)),
      livraisons(id, type, date_reelle, contrat_vente_id)
    `)

  const facturesManquantes: any[] = []
  for (const ca of (contratsAvecVentes ?? [])) {
    for (const cv of (ca.contrats_vente ?? [])) {
      // Livraisons affectées à ce contrat de vente
      const livsCv = (ca.livraisons ?? []).filter((l: any) => l.contrat_vente_id === cv.id)
      if (livsCv.length === 0) continue
      // Toutes réalisées ?
      const toutesRealisees = livsCv.every((l: any) => l.type === 'realisee')
      if (!toutesRealisees) continue
      // Dernière livraison > 30 jours ?
      const derniere = livsCv
        .map((l: any) => l.date_reelle)
        .filter(Boolean)
        .sort()
        .at(-1)
      if (!derniere || derniere > cutoff30) continue
      // Pas encore de facture client ?
      if ((cv.factures_client ?? []).length > 0) continue
      // Nombre de factures attendues = mois distincts de livraison
      const moisDistincts = new Set(livsCv.map((l: any) => l.date_reelle?.slice(0, 7)).filter(Boolean))
      facturesManquantes.push({
        contrat_achat_id: ca.id,
        contrat_achat_numero: ca.numero_contrat,
        produit: ca.produit,
        contrat_vente_id: cv.id,
        contrat_vente_numero: cv.numero_contrat,
        agriculteur: cv.agriculteur,
        derniere_livraison: derniere,
        nb_factures_attendues: moisDistincts.size,
        mois_livraison: [...moisDistincts].sort(),
      })
    }
  }

  // Contrats en alerte (date_fin < 30j avec reliquat)
  const dans30j = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: contratsAlerte } = await supabase
    .from('contrats_achat')
    .select('*,produit:produits(nom),fournisseur:fournisseurs(nom),livraisons(type,quantite_reelle)')
    .eq('statut', 'en_cours')
    .lte('date_fin', dans30j)

  return NextResponse.json({
    contrats: contrats ?? [],
    livraisonsPlanifiees: livraisonsPlanifiees ?? [],
    cmrEnAttente: cmrEnAttente ?? [],
    livraisonsAFacturer: livraisonsAFacturer ?? [],
    rfManquants: rfManquants ?? [],
    facturesManquantes: facturesManquantes ?? [],
    contratsAlerte: contratsAlerte ?? [],
    annee: { debut, fin },
    moisCourant,
    moisSuivant,
  })
}
