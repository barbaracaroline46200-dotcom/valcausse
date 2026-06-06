export const dynamic = 'force-dynamic'
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
      livraisons(id,type,quantite_reelle,quantite_prevue,mois_prevu,montant_transport_reel),
      contrats_vente(id,numero_contrat,quantite,prix_vente,agriculteur_id,agriculteur:agriculteurs(id,nom))
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

  const { livraisons_planifiees, ...contratBody } = body

  const { data: contrat, error } = await supabase
    .from('contrats_achat')
    .insert(contratBody)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Créer les livraisons planifiées si présentes
  if (livraisons_planifiees?.length > 0) {
    const livs = livraisons_planifiees.map((l: any) => ({
      contrat_achat_id: contrat.id,
      type: 'planifiee',
      mois_prevu: l.mois,
      quantite_prevue: l.quantite || 0,
    }))
    await supabase.from('livraisons').insert(livs)
  }

  return NextResponse.json(contrat, { status: 201 })
}
