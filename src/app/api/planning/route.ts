export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function GET() {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('livraisons')
    .select(`
      id,
      type,
      mois_prevu,
      quantite_prevue,
      date_reelle,
      quantite_reelle,
      contrat_achat_id,
      contrat_vente_id,
      transporteur_contacte,
      pdf_envoye,
      transporteur:transporteurs(nom),
      contrat_achat:contrats_achat(
        id,
        numero_contrat,
        statut,
        famille,
        quantite_totale,
        produit:produits(nom),
        fournisseur:fournisseurs(nom),
        transporteur:transporteurs(nom)
      ),
      contrat_vente:contrats_vente(
        id,
        numero_contrat,
        quantite,
        statut,
        destination_silo,
        silo_nom,
        produit:produits(nom),
        agriculteur:agriculteurs(civilite,nom)
      )
    `)
    .order('mois_prevu', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Une vente dont des livraisons ont déjà démarré peut se retrouver avec un reliquat
  // sans plus aucune livraison planifiée pour le couvrir (ex. contrat d'achat source
  // clos avant d'avoir tout livré, ou prochaine tranche jamais programmée). Dans ce cas
  // le reliquat est invisible ici : on matérialise une ligne "à organiser" pour qu'il ne
  // disparaisse jamais silencieusement du planning une fois la dernière livraison réalisée.
  // Une vente qui n'a tout simplement pas encore démarré (aucune livraison réalisée) n'est
  // volontairement pas concernée : ce n'est pas un cas oublié, juste pas encore d'actualité.
  const { data: ventesEnCours, error: errorVentes } = await supabase
    .from('contrats_vente')
    .select(`
      id,
      numero_contrat,
      quantite,
      statut,
      destination_silo,
      silo_nom,
      produit:produits(nom),
      agriculteur:agriculteurs(civilite,nom),
      livraisons(type,quantite_reelle),
      liens:contrats_vente_liens(
        contrat_achat:contrats_achat(
          id,
          numero_contrat,
          statut,
          famille,
          quantite_totale,
          produit:produits(nom),
          fournisseur:fournisseurs(nom),
          transporteur:transporteurs(nom)
        )
      )
    `)
    .eq('statut', 'en_cours')
    .eq('destination_silo', false)

  if (errorVentes) return NextResponse.json({ error: errorVentes.message }, { status: 500 })

  const reliquatsNonCouverts = (ventesEnCours ?? []).flatMap((v: any) => {
    const livs = v.livraisons ?? []
    const nbRealisee = livs.filter((l: any) => l.type === 'realisee').length
    const nbPlanifiee = livs.filter((l: any) => l.type === 'planifiee').length
    const livre = livs.reduce((s: number, l: any) => s + (l.type === 'realisee' ? (l.quantite_reelle ?? 0) : 0), 0)
    const nonCouvert = (v.quantite ?? 0) - livre
    // Déjà soldée, pas encore démarrée, ou déjà une livraison planifiée pour la suite
    if (nbRealisee === 0 || nbPlanifiee > 0 || nonCouvert <= 0.01) return []

    const liens = v.liens ?? []
    const achat = liens.find((l: any) => l.contrat_achat?.statut === 'en_cours')?.contrat_achat
      ?? liens[0]?.contrat_achat
      ?? null

    return [{
      id: `reliquat-${v.id}`,
      type: 'planifiee',
      mois_prevu: null,
      quantite_prevue: nonCouvert,
      date_reelle: null,
      quantite_reelle: null,
      contrat_achat_id: achat?.id ?? null,
      contrat_vente_id: v.id,
      transporteur_contacte: false,
      pdf_envoye: false,
      transporteur: null,
      contrat_achat: achat,
      contrat_vente: {
        id: v.id,
        numero_contrat: v.numero_contrat,
        quantite: v.quantite,
        statut: v.statut,
        destination_silo: v.destination_silo,
        silo_nom: v.silo_nom,
        produit: v.produit,
        agriculteur: v.agriculteur,
      },
    }]
  })

  return NextResponse.json([...(data ?? []), ...reliquatsNonCouverts])
}
