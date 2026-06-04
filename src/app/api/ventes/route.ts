export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const supabase = getServiceClient()

  let query = supabase
    .from('contrats_vente')
    .select(`
      *,
      produit:produits(*),
      agriculteur:agriculteurs(*),
      contrat_achat:contrats_achat(id,numero_contrat,famille,fournisseur:fournisseurs(id,nom),transporteur:transporteurs(id,nom)),
      factures_client(*)
    `)
    .order('created_at', { ascending: false })

  const statut = searchParams.get('statut')
  const agriculteurId = searchParams.get('agriculteur_id')
  const produitId = searchParams.get('produit_id')
  const contratAchatId = searchParams.get('contrat_achat_id')

  if (statut) query = query.eq('statut', statut)
  if (agriculteurId) query = query.eq('agriculteur_id', agriculteurId)
  if (produitId) query = query.eq('produit_id', produitId)
  if (contratAchatId) {
    if (contratAchatId === 'null') query = query.is('contrat_achat_id', null)
    else query = query.eq('contrat_achat_id', contratAchatId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('contrats_vente').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
