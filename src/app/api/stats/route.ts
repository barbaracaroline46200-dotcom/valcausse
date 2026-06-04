export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function GET() {
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('contrats_achat')
    .select(`
      id, numero_contrat, famille, quantite_totale, prix_achat, prix_transport_prevu, statut, date_debut, date_fin,
      produit:produits(id, nom),
      fournisseur:fournisseurs(id, nom),
      livraisons(id, type, quantite_reelle, montant_transport_reel, date_reelle),
      factures_fournisseur(id, montant_ht),
      contrats_vente(
        id, prix_vente, quantite,
        agriculteur:agriculteurs(id, nom),
        factures_client(id, montant_ht)
      )
    `)
    .order('date_debut', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
