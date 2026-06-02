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
      livraisons(*),
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
