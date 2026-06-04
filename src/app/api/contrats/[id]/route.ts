export const dynamic = 'force-dynamic'
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
  const id = params.id

  // 1. Récupérer les livraisons pour supprimer leurs factures client associées
  const { data: livraisons } = await supabase
    .from('livraisons').select('id').eq('contrat_achat_id', id)
  const livraisonIds = (livraisons ?? []).map((l: any) => l.id)

  // 2. Récupérer les contrats de vente pour supprimer leurs factures client
  const { data: ventesData } = await supabase
    .from('contrats_vente').select('id').eq('contrat_achat_id', id)
  const venteIds = (ventesData ?? []).map((v: any) => v.id)

  // 3. Supprimer les factures client liées aux contrats de vente
  if (venteIds.length > 0) {
    const { error: e } = await supabase.from('factures_client').delete().in('contrat_vente_id', venteIds)
    if (e) return NextResponse.json({ error: e.message }, { status: 400 })
  }

  // 4. Couper la FK livraisons.facture_fournisseur_id → factures_fournisseur (NO ACTION)
  //    Sans ça, la suppression des factures fournisseur échoue car les livraisons les référencent encore
  if (livraisonIds.length > 0) {
    const { error: e } = await supabase
      .from('livraisons')
      .update({ facture_fournisseur_id: null })
      .in('id', livraisonIds)
    if (e) return NextResponse.json({ error: e.message }, { status: 400 })
  }

  // 5. Supprimer les factures fournisseur
  const { error: e2 } = await supabase.from('factures_fournisseur').delete().eq('contrat_achat_id', id)
  if (e2) return NextResponse.json({ error: e2.message }, { status: 400 })

  // 6. Supprimer les livraisons
  const { error: e3 } = await supabase.from('livraisons').delete().eq('contrat_achat_id', id)
  if (e3) return NextResponse.json({ error: e3.message }, { status: 400 })

  // 6. Supprimer les contrats de vente
  const { error: e4 } = await supabase.from('contrats_vente').delete().eq('contrat_achat_id', id)
  if (e4) return NextResponse.json({ error: e4.message }, { status: 400 })

  // 7. Supprimer le contrat d'achat
  const { error: e5 } = await supabase.from('contrats_achat').delete().eq('id', id)
  if (e5) return NextResponse.json({ error: e5.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
