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
      livraisons(id,type,quantite_prevue,quantite_reelle,mois_prevu,date_reelle,contrat_vente_id,destination_silo,transporteur_id,transporteur:transporteurs(id,nom),ville_chargement,ville_destination,piece_fournisseur_prefixe,piece_fournisseur_numero,piece_client_prefixe,piece_client_numero,numero_lettre_voiture,numero_mise_a_disposition,montant_transport_reel,transport_facture,transporteur_contacte,agriculteur_contacte,date_souhaitee,semaine_souhaitee,pdf_envoye,date_prevue,semaine_prevue,note_alerte,facture_fournisseur_id),
      factures_fournisseur(*)
    `)
    .eq('id', params.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Contrats de vente liés via la table de répartition (une vente peut être scindée
  // sur plusieurs contrats d'achat, chacun avec sa propre tranche de quantité).
  const { data: liens } = await supabase
    .from('contrats_vente_liens')
    .select('id,quantite,contrat_vente:contrats_vente(*,agriculteur:agriculteurs(*),produit:produits(*),factures_client(*))')
    .eq('contrat_achat_id', params.id)

  data.contrats_vente = (liens ?? [])
    .filter((l: any) => l.contrat_vente)
    .map((l: any) => ({
      ...l.contrat_vente,
      quantite_liee: l.quantite,
      quantite_totale_vente: l.contrat_vente.quantite,
      lien_id: l.id,
    }))

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

  // 2. Récupérer les contrats de vente liés à cet achat, et ne garder que ceux qui
  //    ne sont liés à AUCUN autre contrat d'achat (une vente scindée sur plusieurs
  //    achats doit survivre à la suppression de l'un d'eux, avec sa tranche restante).
  const { data: liensData } = await supabase
    .from('contrats_vente_liens').select('contrat_vente_id').eq('contrat_achat_id', id)
  const venteIdsLiees = (liensData ?? []).map((l: any) => l.contrat_vente_id)

  let venteIds: string[] = []
  if (venteIdsLiees.length > 0) {
    const { data: autresLiens } = await supabase
      .from('contrats_vente_liens').select('contrat_vente_id').in('contrat_vente_id', venteIdsLiees).neq('contrat_achat_id', id)
    const idsAvecAutreLien = new Set((autresLiens ?? []).map((l: any) => l.contrat_vente_id))
    venteIds = venteIdsLiees.filter((vid: string) => !idsAvecAutreLien.has(vid))
  }

  // 3. Supprimer les factures client liées à ces contrats de vente
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

  // 6. Supprimer les contrats de vente devenus orphelins (plus liés à aucun achat)
  if (venteIds.length > 0) {
    const { error: e4 } = await supabase.from('contrats_vente').delete().in('id', venteIds)
    if (e4) return NextResponse.json({ error: e4.message }, { status: 400 })
  }

  // 6bis. Les ventes qui survivent (encore liées à un autre achat) mais dont le lien
  //    "principal" pointait sur ce contrat doivent être repointées, sinon la suppression
  //    du contrat d'achat échoue sur la FK contrats_vente.contrat_achat_id
  const venteIdsRestantes = venteIdsLiees.filter((vid: string) => !venteIds.includes(vid))
  if (venteIdsRestantes.length > 0) {
    const { data: cvRestantes } = await supabase.from('contrats_vente').select('id,contrat_achat_id').in('id', venteIdsRestantes)
    for (const cv of (cvRestantes ?? [])) {
      if (cv.contrat_achat_id !== id) continue
      const { data: autreLien } = await supabase
        .from('contrats_vente_liens').select('contrat_achat_id').eq('contrat_vente_id', cv.id).neq('contrat_achat_id', id).limit(1).maybeSingle()
      await supabase.from('contrats_vente').update({ contrat_achat_id: autreLien?.contrat_achat_id ?? null }).eq('id', cv.id)
    }
  }

  // 7. Supprimer le contrat d'achat (supprime aussi en cascade ses liens de répartition
  //    vers les contrats de vente restés liés à un autre contrat d'achat)
  const { error: e5 } = await supabase.from('contrats_achat').delete().eq('id', id)
  if (e5) return NextResponse.json({ error: e5.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
