export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('factures_client')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceClient()
  // Récupérer le contrat_vente_id avant suppression
  const { data: fc } = await supabase.from('factures_client').select('contrat_vente_id').eq('id', params.id).single()
  const { error } = await supabase.from('factures_client').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  // Remettre les livraisons concernées dans "à saisir" (verifie=true, saisie=false)
  if (fc?.contrat_vente_id) {
    await supabase.from('livraisons')
      .update({ facture_client_saisie: false, verifie_client: true })
      .eq('contrat_vente_id', fc.contrat_vente_id)
      .eq('facture_client_saisie', true)
  }
  return NextResponse.json({ ok: true })
}
