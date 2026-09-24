export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Ajoute (ou met à jour) la tranche de quantité liée à un contrat d'achat pour ce contrat
// de vente. Permet de répartir un même contrat de vente sur plusieurs contrats d'achat.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { contrat_achat_id, quantite } = body
  if (!contrat_achat_id || !(quantite > 0)) {
    return NextResponse.json({ error: 'contrat_achat_id et quantite (> 0) requis' }, { status: 400 })
  }
  const supabase = getServiceClient()

  const { data: lien, error } = await supabase
    .from('contrats_vente_liens')
    .upsert({ contrat_vente_id: params.id, contrat_achat_id, quantite }, { onConflict: 'contrat_vente_id,contrat_achat_id' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Garde contrats_vente.contrat_achat_id synchronisé avec un des liens existants,
  // pour les écrans qui lisent encore ce champ directement (compat historique).
  const { data: cv } = await supabase.from('contrats_vente').select('contrat_achat_id').eq('id', params.id).single()
  if (!cv?.contrat_achat_id) {
    await supabase.from('contrats_vente').update({ contrat_achat_id }).eq('id', params.id)
  }

  return NextResponse.json(lien, { status: 201 })
}

// Retire le lien vers un contrat d'achat donné (query ?contrat_achat_id=...)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const contratAchatId = new URL(req.url).searchParams.get('contrat_achat_id')
  if (!contratAchatId) return NextResponse.json({ error: 'contrat_achat_id requis' }, { status: 400 })
  const supabase = getServiceClient()

  const { error } = await supabase
    .from('contrats_vente_liens').delete().eq('contrat_vente_id', params.id).eq('contrat_achat_id', contratAchatId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Si ce lien était le contrat d'achat "principal" de la vente, le repointer vers
  // un lien restant (ou null si la vente n'est plus liée à aucun achat).
  const { data: cv } = await supabase.from('contrats_vente').select('contrat_achat_id').eq('id', params.id).single()
  if (cv?.contrat_achat_id === contratAchatId) {
    const { data: autreLien } = await supabase
      .from('contrats_vente_liens').select('contrat_achat_id').eq('contrat_vente_id', params.id).limit(1).maybeSingle()
    await supabase.from('contrats_vente').update({ contrat_achat_id: autreLien?.contrat_achat_id ?? null }).eq('id', params.id)
  }

  return NextResponse.json({ ok: true })
}
