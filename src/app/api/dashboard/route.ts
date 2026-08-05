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
      transporteur:transporteurs(id,nom,telephone),
      contrat_vente:contrats_vente(id,numero_contrat,produit:produits(nom,famille),agriculteur:agriculteurs(civilite,nom,ville_livraison,telephone)),
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
    transporteur:transporteurs(id,nom,email,telephone),
    contrat_vente:contrats_vente(id, numero_contrat, quantite, destination_silo, silo_nom, produit:produits(nom,famille), agriculteur:agriculteurs(id,civilite,nom,ville_livraison)),
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
    transporteur:transporteurs(id,nom),
    contrat_vente:contrats_vente(id, numero_contrat, destination_silo, prix_vente, produit:produits(id,nom), agriculteur:agriculteurs(id,civilite,nom)),
    contrat_achat:contrats_achat(
      id, numero_contrat, famille, prix_achat, mbm_autorise, prix_transport_prevu,
      produit:produits(id,nom),
      transporteur:transporteurs(id,nom),
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

  // Majoration bi-mensuelle (MBM) : prime qui augmente par quinzaine sur la campagne,
  // appliquée si le contrat d'achat négoce l'autorise (contrat_achat.mbm_autorise).
  const { data: majorationsRaw } = await supabase
    .from('majorations_negoce')
    .select('produit_id,date_debut,valeur')
    .order('date_debut', { ascending: true })
  const majorationsParProduit = new Map<string, { date_debut: string; valeur: number }[]>()
  for (const m of majorationsRaw ?? []) {
    const arr = majorationsParProduit.get(m.produit_id) ?? []
    arr.push({ date_debut: m.date_debut, valeur: Number(m.valeur) })
    majorationsParProduit.set(m.produit_id, arr)
  }
  function calcMajoration(l: any): number {
    const ca = l.contrat_achat
    if (!ca?.mbm_autorise || ca.famille !== 'negoce' || !l.date_reelle) return 0
    const produitId = ca.produit?.id
    if (!produitId) return 0
    const paliers = majorationsParProduit.get(produitId)
    if (!paliers) return 0
    let valeur = 0
    for (const p of paliers) {
      if (p.date_debut > l.date_reelle) break
      valeur = p.valeur
    }
    return valeur
  }
  for (const l of livraisonsRealisees) {
    ;(l as any).majoration_unitaire = calcMajoration(l)
  }

  const livraisonsAFacturer = livraisonsRealisees.filter(
    // Pas de contrat d'achat (vente départ silo) → pas de fournisseur à facturer
    (l: any) => !l.transport_facture || (l.contrat_achat_id && !l.facture_fournisseur_id)
  )

  // Facturation client : livraisons réalisées non-silo, par étape de workflow
  const livraisonsClientBase = livraisonsRealisees.filter((l: any) => {
    const cv = l.contrat_achat?.contrats_vente?.find((v: any) => v.id === l.contrat_vente_id) ?? l.contrat_vente
    return cv && !cv.destination_silo
  })
  const livraisonsAVerifierClient = livraisonsClientBase.filter(
    (l: any) => !l.verifie_client && !l.facture_client_saisie
  )
  const livraisonsAFacturerClient = livraisonsClientBase.filter(
    (l: any) => l.verifie_client && !l.facture_client_saisie
  )

  // RF à récupérer : factures fournisseur sans numéro RF
  const { data: rfManquants } = await supabase
    .from('factures_fournisseur')
    .select(`
      *,
      contrat_achat:contrats_achat(id, numero_contrat, famille, produit:produits(nom), fournisseur:fournisseurs(nom))
    `)
    .is('numero_rf', null)
    .not('numero_facture', 'is', null)
    .order('date_facture', { ascending: false })

  // Contrats en alerte (date_fin < 30j avec reliquat)
  const dans30j = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: contratsAlerte } = await supabase
    .from('contrats_achat')
    .select('*,produit:produits(nom),fournisseur:fournisseurs(nom),livraisons(type,quantite_reelle),contrats_vente(id,quantite,agriculteur:agriculteurs(nom))')
    .eq('statut', 'en_cours')
    .lte('date_fin', dans30j)

  // Contrats sans prix d'achat défini — à fixer avant leur date de début
  // (filtre is.null peu fiable sur Vercel, on filtre en JS comme ailleurs dans ce fichier)
  const { data: contratsPrixRaw } = await supabase
    .from('contrats_achat')
    .select('id,numero_contrat,famille,date_debut,quantite_totale,prix_achat,produit:produits(nom),fournisseur:fournisseurs(nom)')
    .eq('statut', 'en_cours')
  const contratsSansPrix = (contratsPrixRaw ?? [])
    .filter((c: any) => c.prix_achat == null)
    .sort((a: any, b: any) => (a.date_debut ?? '9999-99-99').localeCompare(b.date_debut ?? '9999-99-99'))

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
    contratsSansPrix,
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
