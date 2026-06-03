import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const supabase = getServiceClient()
  const like = `%${q}%`

  // Détection d'une recherche par poids (ex: "27.92", "27,92", "28")
  const qNormalized = q.replace(',', '.')
  const qNumber = parseFloat(qNormalized)
  const isWeightSearch = !isNaN(qNumber) && qNumber > 0

  const [contrats, ventes, livraisons, fournisseurs, agriculteurs, transporteurs, livraisonsParPoids] = await Promise.all([
    supabase
      .from('contrats_achat')
      .select('id,numero_contrat,famille,produit:produits(nom),fournisseur:fournisseurs(nom)')
      .or(`numero_contrat.ilike.${like},reference_fournisseur.ilike.${like},ville_chargement.ilike.${like},numero_mise_a_disposition.ilike.${like}`)
      .limit(10),

    supabase
      .from('contrats_vente')
      .select('id,numero_contrat,produit:produits(nom),agriculteur:agriculteurs(nom)')
      .or(`numero_contrat.ilike.${like}`)
      .limit(10),

    supabase
      .from('livraisons')
      .select('id,contrat_achat_id,piece_fournisseur_prefixe,piece_fournisseur_numero,piece_client_prefixe,piece_client_numero,numero_lettre_voiture,ville_chargement,ville_destination')
      .or(`piece_fournisseur_numero.ilike.${like},piece_client_numero.ilike.${like},numero_lettre_voiture.ilike.${like},ville_chargement.ilike.${like},ville_destination.ilike.${like}`)
      .limit(10),

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
      .select('id,nom')
      .ilike('nom', like)
      .limit(10),

    // Recherche par poids : livraisons réalisées avec quantite_reelle ≈ valeur saisie (±0.5t)
    isWeightSearch
      ? supabase
          .from('livraisons')
          .select(`
            id, contrat_achat_id, quantite_reelle, quantite_prevue, type,
            date_reelle, mois_prevu, ville_chargement, ville_destination,
            piece_fournisseur_prefixe, piece_fournisseur_numero,
            piece_client_prefixe, piece_client_numero, numero_lettre_voiture,
            contrat_achat:contrats_achat(id, numero_contrat, famille, produit:produits(nom), fournisseur:fournisseurs(nom))
          `)
          .gte('quantite_reelle', qNumber - 0.5)
          .lte('quantite_reelle', qNumber + 0.5)
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
