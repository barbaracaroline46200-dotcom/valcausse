import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('contrats_achat')
    .select(`
      *,
      produit:produits(*),
      fournisseur:fournisseurs(*,points_chargement(*)),
      courtier:courtiers(*),
      transporteur:transporteurs(*),
      livraisons(id,type,quantite_prevue,quantite_reelle,mois_prevu,date_reelle,contrat_vente_id,destination_silo,transporteur_id,ville_chargement,ville_destination,piece_fournisseur_prefixe,piece_fournisseur_numero,piece_client_prefixe,piece_client_numero,numero_lettre_voiture,numero_mise_a_disposition,montant_transport_reel,transport_facture,transporteur_contacte),
      contrats_vente(*,agriculteur:agriculteurs(*),produit:produits(*),factures_client(*)),
      factures_fournisseur(*)
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
    .from('contrats_achat')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceClient()
  const { error } = await supabase.from('contrats_achat').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
