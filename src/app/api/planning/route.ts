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
        destination_silo,
        silo_nom,
        agriculteur:agriculteurs(civilite,nom)
      )
    `)
    .order('mois_prevu', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
