export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('contrats_vente')
    .select(`
      *,
      agriculteur:agriculteurs(*),
      produit:produits(*),
      contrat_achat:contrats_achat(
        id, numero_contrat, famille,
        produit:produits(nom),
        fournisseur:fournisseurs(nom),
        transporteur:transporteurs(nom)
      ),
      livraisons(
        id, type, mois_prevu, date_prevue, date_reelle, semaine_prevue,
        quantite_prevue, quantite_reelle, ville_chargement, ville_destination,
        numero_lettre_voiture, transporteur_contacte
      ),
      factures_client(id, numero_facture_logiciel, montant_ht, montant_ttc, mode_paiement, date_paiement)
    `)
    .eq('id', params.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('contrats_vente').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceClient()
  const { error } = await supabase.from('contrats_vente').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
