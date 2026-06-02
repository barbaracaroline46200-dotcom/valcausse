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

  // Livraisons planifiées ce mois sans transporteur contacté
  const now = new Date()
  const moisDebut = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const moisFin = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const { data: livraisonsPlanifiees } = await supabase
    .from('livraisons')
    .select(`
      *,
      contrat_achat:contrats_achat(
        numero_contrat,famille,
        produit:produits(nom),
        fournisseur:fournisseurs(nom),
        transporteur:transporteurs(id,nom),
        contrats_vente(agriculteur:agriculteurs(nom,ville_livraison))
      )
    `)
    .eq('type', 'planifiee')
    .eq('transporteur_contacte', false)
    .gte('mois_prevu', moisDebut)
    .lte('mois_prevu', moisFin)

  // CMR en attente (réalisées depuis > 14j sans lettre de voiture)
  const cutoff14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: cmrEnAttente } = await supabase
    .from('livraisons')
    .select(`
      *,
      contrat_achat:contrats_achat(
        famille,
        produit:produits(nom),
        transporteur:transporteurs(nom,email,telephone)
      )
    `)
    .eq('type', 'realisee')
    .is('numero_lettre_voiture', null)
    .lte('date_reelle', cutoff14)

  // Factures clients à récupérer (réalisées > 30j sans facture client)
  const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: facturesManquantes } = await supabase
    .from('livraisons')
    .select(`
      *,
      contrat_achat:contrats_achat(
        produit:produits(nom),
        contrats_vente(id,numero_contrat,agriculteur:agriculteurs(nom))
      )
    `)
    .eq('type', 'realisee')
    .is('facture_fournisseur_id', null)
    .lte('date_reelle', cutoff30)

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
    facturesManquantes: facturesManquantes ?? [],
    contratsAlerte: contratsAlerte ?? [],
    annee: { debut, fin },
  })
}
