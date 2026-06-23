import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { getAnneeAgricoleISO } from '@/lib/annee-agricole'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

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

  // "À organiser" = planifiées NON encore confirmées par le transporteur, dans la fenêtre temporelle
  const { data: livraisonsPlanifieesRaw } = await supabase
    .from('livraisons')
    .select(`
      *,
      contrat_achat:contrats_achat(
        id,numero_contrat,famille,gere_par_silo,
        produit:produits(nom),
        fournisseur:fournisseurs(nom),
        transporteur:transporteurs(id,nom,telephone),
        contrats_vente(id,agriculteur:agriculteurs(civilite,nom,ville_livraison,telephone))
      )
    `)
    .eq('type', 'planifiee')
    .order('mois_prevu', { ascending: true })

  // Filtrer en JS (les filtres PostgREST sur booléens et dates sont peu fiables sur Vercel)
  const livraisonsPlanifiees = (livraisonsPlanifieesRaw ?? []).filter(
    (l: any) =>
      !l.transporteur_contacte &&                              // pas encore confirmé
      l.mois_prevu && l.mois_prevu.slice(0, 10) <= moisFin && // dans la fenêtre temporelle
      !l.contrat_achat?.gere_par_silo                          // exclure les contrats gérés par le silo
  )

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
      fournisseur:fournisseurs(nom),
      transporteur:transporteurs(id,nom,email,telephone),
      contrats_vente(id, numero_contrat, quantite, destination_silo, silo_nom, agriculteur:agriculteurs(id,civilite,nom,ville_livraison))
    )
  `

  // Tous les filtres critiques sont faits en JS — les filtres PostgREST sont peu fiables sur Vercel
  // (is.null, eq.false, eq.true, lte.date sont tous ignorés silencieusement)
  const { data: toutesLivraisons } = await supabase
    .from('livraisons')
    .select(cmrSelect)
    .order('date_reelle', { ascending: true })

  // Silo (pas silo gare) : pas de CMR/LC requis, seulement poids + BA (piece_fournisseur_numero)
  function estSiloSansGare(l: any) {
    const cv = (l.contrat_achat?.contrats_vente ?? []).find((cv: any) => cv.id === l.contrat_vente_id)
      ?? l.contrat_achat?.contrats_vente?.[0]
    if (!cv?.destination_silo) return false
    return !(cv.silo_nom ?? '').toLowerCase().includes('gare')
  }

  const cmrRealisees = (toutesLivraisons ?? []).filter((l: any) => {
    if (l.type !== 'realisee' || l.solde_ouverture) return false
    if (estSiloSansGare(l)) return !l.piece_fournisseur_numero  // BA manquant
    return !l.numero_lettre_voiture
  })
  const cmrPlanifiees = (toutesLivraisons ?? []).filter(
    (l: any) => l.type === 'planifiee' && !!l.transporteur_contacte && !l.solde_ouverture
  )

  // Fusion + dédoublonnage + tri : plus vieille date en premier
  const cmrMap = new Map<string, any>()
  for (const l of [...cmrRealisees, ...cmrPlanifiees]) {
    cmrMap.set(l.id, l)
  }
  const cmrEnAttente = Array.from(cmrMap.values()).sort((a, b) => {
    const da = a.date_prevue || a.date_souhaitee || a.date_reelle || a.mois_prevu || ''
    const db = b.date_prevue || b.date_souhaitee || b.date_reelle || b.mois_prevu || ''
    return da < db ? -1 : da > db ? 1 : 0
  })

  const cutoff7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const cmrEnRetard = cmrEnAttente.filter((l: any) => {
    const dateRef = l.type === 'realisee' ? l.date_reelle : l.date_prevue
    return dateRef && dateRef <= cutoff7
  })

  // Facturation en attente : réalisées sans facture transport ou fournisseur
  const facturationSelect = `
    *,
    contrat_achat:contrats_achat(
      id, numero_contrat, famille,
      produit:produits(nom),
      transporteur:transporteurs(nom),
      fournisseur:fournisseurs(nom),
      contrats_vente(id, numero_contrat, destination_silo, prix_vente, agriculteur:agriculteurs(id,civilite,nom))
    )
  `
  const { data: livraisonsAFacturerRaw } = await supabase
    .from('livraisons')
    .select(facturationSelect)
    .order('date_reelle', { ascending: false })
  const livraisonsRealisees = (livraisonsAFacturerRaw ?? []).filter(
    (l: any) => l.type === 'realisee' && !l.solde_ouverture
  )
  const livraisonsAFacturer = livraisonsRealisees.filter(
    (l: any) => !l.transport_facture || !l.facture_fournisseur_id
  )

  // Facturation client : livraisons réalisées non-silo, par étape de workflow
  const livraisonsClientBase = livraisonsRealisees.filter((l: any) => {
    const cv = l.contrat_achat?.contrats_vente?.find((v: any) => v.id === l.contrat_vente_id)
    return cv && !cv.destination_silo
  })
  const livraisonsAVerifierClient = livraisonsClientBase.filter(
    (l: any) => !l.verifie_client && !l.facture_client_saisie
  )
  const livraisonsAFacturerClient = livraisonsClientBase.filter(
    (l: any) => l.verifie_client && !l.facture_client_saisie
  )

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

  // Contrats en alerte (date_fin < 30j avec reliquat)
  const dans30j = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: contratsAlerte } = await supabase
    .from('contrats_achat')
    .select('*,produit:produits(nom),fournisseur:fournisseurs(nom),livraisons(type,quantite_reelle),contrats_vente(id,quantite,agriculteur:agriculteurs(nom))')
    .eq('statut', 'en_cours')
    .lte('date_fin', dans30j)

  return NextResponse.json({
    contrats: contrats ?? [],
    livraisonsPlanifiees: livraisonsPlanifiees,
    cmrEnAttente: cmrEnAttente ?? [],
    cmrEnRetard: cmrEnRetard ?? [],
    livraisonsAFacturer: livraisonsAFacturer ?? [],
    rfManquants: rfManquants ?? [],
    livraisonsAVerifierClient,
    livraisonsAFacturerClient,
    contratsAlerte: contratsAlerte ?? [],
    annee: { debut, fin },
    moisCourant,
    moisSuivant,
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    }
  })
}
