export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { livraison_ids, ...factureBody } = await req.json()
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('factures_client').insert(factureBody).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Marquer les livraisons concernées comme facturées côté client
  if (livraison_ids?.length) {
    await supabase.from('livraisons').update({ facture_client_saisie: true }).in('id', livraison_ids)
  }

  return NextResponse.json(data, { status: 201 })
}
