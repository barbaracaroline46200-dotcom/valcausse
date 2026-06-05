export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function GET() {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('tarifs_transport')
    .select('*, transporteur:transporteurs(id,nom,telephone,email)')
    .order('lieu_chargement')
    .order('lieu_destination')
    .order('prix_par_tonne')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('tarifs_transport')
    .insert(body)
    .select('*, transporteur:transporteurs(id,nom)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
