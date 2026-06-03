import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') // YYYY-MM-DD ou null = tout
  const supabase = getServiceClient()

  let query = supabase
    .from('agenda_notes')
    .select('*')
    .order('date_note', { ascending: true })
    .order('created_at', { ascending: true })

  if (date) {
    query = query.eq('date_note', date)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { titre, contenu, date_note } = body
  if (!titre || !date_note) return NextResponse.json({ error: 'titre et date_note requis' }, { status: 400 })

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('agenda_notes')
    .insert({ titre, contenu: contenu ?? '', date_note })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
