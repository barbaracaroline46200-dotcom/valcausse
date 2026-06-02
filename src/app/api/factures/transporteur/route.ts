import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const supabase = getServiceClient()
  let query = supabase.from('factures_transporteur').select('*,transporteur:transporteurs(*)').order('mois_facture', { ascending: false })
  const transporteurId = searchParams.get('transporteur_id')
  if (transporteurId) query = query.eq('transporteur_id', transporteurId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('factures_transporteur').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
