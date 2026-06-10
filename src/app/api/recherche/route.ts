export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const supabase = getServiceClient()
  const like = `%${q}%`

  // Détection recherche par poids (ex: "27.92", "27,92")
  const qNormalized = q.replace(',', '.')
  const qNumber = parseFloat(qNormalized)
  const isWeightSearch = !isNaN(qNumber) && qNormalized === String(qNumber) && qNumber > 0

  // Si la recherche contient un "." (ex: "EA.0411066"), on cherche aussi la partie après le point
  const dotIdx = q.indexOf('.')
  const qAfterDot = !isWeightSearch && dotIdx > 0 ? q.slice(dotIdx + 1) : ''
  const likeAfterDot = qAfterDot.length >= 2 ? `%${qAfterDot}%` : null

  // Champs livraisons pour la recherche principale
  const livraisonsOrParts = [
    `piece_fournisseur_numero.ilike.${like}`,
    `piece_client_numero.ilike.${like}`,
    `numero_lettre_voiture.ilike.${like}`,
    `ville_chargement.ilike.${like}`,
    `ville_destination.ilike.${like}`,
    `numero_mise_a_disposition.ilike.${like}`,
  ]
  // Si format "PREFIX.NUM", chercher aussi juste le numéro
  if (likeAfterDot) {
    livraisonsOrParts.push(`piece_fournisseur_numero.ilike.${likeAfterDot}`)
    livraisonsOrParts.push(`piece_client_numero.ilike.${likeAfterDot}`)
    livraisonsOrParts.push(`numero_lettre_voiture.ilike.${likeAfterDot}`)
  }

  const [contrats, ventes, livraisons, fournisseurs, agriculteurs, transporteurs, livraisonsParPoids] = await Promise.all([
    supabase
      .from('contrats_achat')
      .select('id,numero_contrat,famille,produit:produits(nom),fournisseur:fournisseurs(nom)')
      .or(`numero_contrat.ilike.${like},reference_fournisseur.ilike.${like},ville_chargement.ilike.${like},notes.ilike.${like}`)
      .limit(10),

    supabase
      .from('contrats_vente')
      .select('id,numero_contrat,produit:produits(nom),agriculteur:agriculteurs(civilite,nom)')
      .or(`numero_contrat.ilike.${like},notes.ilike.${like}`)
      .limit(10),

    supabase
      .from('livraisons')
      .select(`
        id, contrat_achat_id, contrat_vente_id, type,
        piece_fournisseur_prefixe, piece_fournisseur_numero,
        piece_client_prefixe, piece_client_numero,
        numero_lettre_voiture, numero_mise_a_disposition,
        ville_chargement, ville_destination,
        date_reelle, mois_prevu,
        contrat_achat:contrats_achat(id, numero_contrat, famille, produit:produits(nom), fournisseur:fournisseurs(nom)),
        contrat_vente:contrats_vente(id, numero_contrat, agriculteur:agriculteurs(civilite,nom))
      `)
      .or(livraisonsOrParts.join(','))
      .limit(15),

    supabase
      .from('fournisseurs')
      .select('id,nom')
      .ilike('nom', like)
      .limit(10),

    supabase
      .from('agriculteurs')
      .select('id,nom,ville_livraison')
      .or(`nom.ilike.${like},ville_livraison.ilike.${like}`)
      .limit(10),

    supabase
      .from('transporteurs')
      .select('id,nom,email,telephone')
      .or(`nom.ilike.${like},email.ilike.${like},telephone.ilike.${like}`)
      .limit(10),

    // Recherche par poids exact
    isWeightSearch
      ? supabase
          .from('livraisons')
          .select(`
            id, contrat_achat_id, contrat_vente_id, quantite_reelle, quantite_prevue, type,
            date_reelle, mois_prevu, ville_chargement, ville_destination,
            piece_fournisseur_prefixe, piece_fournisseur_numero,
            piece_client_prefixe, piece_client_numero, numero_lettre_voiture,
            contrat_achat:contrats_achat(id, numero_contrat, famille, produit:produits(nom), fournisseur:fournisseurs(nom)),
            contrat_vente:contrats_vente(id, numero_contrat, agriculteur:agriculteurs(civilite,nom))
          `)
          .eq('quantite_reelle', qNumber)
          .eq('type', 'realisee')
          .order('date_reelle', { ascending: false })
          .limit(15)
      : Promise.resolve({ data: [] }),
  ])

  return NextResponse.json({
    contrats: contrats.data ?? [],
    ventes: ventes.data ?? [],
    livraisons: livraisons.data ?? [],
    fournisseurs: fournisseurs.data ?? [],
    agriculteurs: agriculteurs.data ?? [],
    transporteurs: transporteurs.data ?? [],
    livraisonsParPoids: livraisonsParPoids.data ?? [],
  })
}
