import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const supabase = getServiceClient()

  let query = supabase
    .from('contrats_achat')
    .select(`
      *,
      produit:produits(*),
      fournisseur:fournisseurs(id,nom),
      courtier:courtiers(id,nom,numero_courtier),
      transporteur:transporteurs(id,nom),
      livraisons(id,type,quantite_reelle,quantite_prevue,mois_prevu)
    `)
    .order('created_at', { ascending: false })

  const famille = searchParams.get('famille')
  const statut = searchParams.get('statut')
  const produitId = searchParams.get('produit_id')
  const fournisseurId = searchParams.get('fournisseur_id')
  const transporteurId = searchParams.get('transporteur_id')
  const anneeDebut = searchParams.get('annee_debut')
  const anneeFin = searchParams.get('annee_fin')

  if (famille) query = query.eq('famille', famille)
  if (statut) query = query.eq('statut', statut)
  if (produitId) query = query.eq('produit_id', produitId)
  if (fournisseurId) query = query.eq('fournisseur_id', fournisseurId)
  if (transporteurId) query = query.eq('transporteur_id', transporteurId)
  if (anneeDebut) query = query.gte('date_debut', anneeDebut)
  if (anneeFin) query = query.lte('date_fin', anneeFin)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('contrats_achat').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
