export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const supabase = getServiceClient()

  let query = supabase
    .from('livraisons')
    .select(`
      *,
      contrat_achat:contrats_achat(
        *,
        produit:produits(*),
        fournisseur:fournisseurs(id,nom),
        transporteur:transporteurs(id,nom),
        contrats_vente(id,agriculteur:agriculteurs(id,civilite,nom,ville_livraison))
      )
    `)
    .order('mois_prevu', { ascending: false })

  const type = searchParams.get('type')
  const contratId = searchParams.get('contrat_achat_id')
  const mois = searchParams.get('mois')
  const transporteurId = searchParams.get('transporteur_id')
  const transporteurContacte = searchParams.get('transporteur_contacte')
  const sansLettreVoiture = searchParams.get('sans_lettre_voiture')
  const sansFf = searchParams.get('sans_facture_fournisseur')

  if (type) query = query.eq('type', type)
  if (contratId) query = query.eq('contrat_achat_id', contratId)
  if (mois) {
    const d = new Date(mois)
    const debut = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
    // Livraisons du mois exact (toutes) + livraisons planifiées en retard (mois passés non réalisées)
    query = query.or(`and(mois_prevu.gte.${debut},mois_prevu.lte.${fin}),and(mois_prevu.lt.${debut},type.eq.planifiee)`)
  }
  if (transporteurContacte === 'false') query = query.eq('transporteur_contacte', false)
  if (sansLettreVoiture === 'true') query = query.is('numero_lettre_voiture', null)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filtre transporteur : livraison spécifique OU transporteur par défaut du contrat
  let result = data ?? []
  if (transporteurId) {
    result = result.filter((l: any) =>
      l.transporteur_id === transporteurId ||
      (!l.transporteur_id && l.contrat_achat?.transporteur_id === transporteurId)
    )
  }
  if (sansFf === 'true') {
    result = result.filter((l: any) => l.type === 'realisee' && !l.facture_fournisseur_id)
  }

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('livraisons').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
