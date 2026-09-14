export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { getControleFacturation } from '@/lib/controle-facturation'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateDebut = searchParams.get('date_debut')
  const dateFin = searchParams.get('date_fin')

  if (!dateDebut || !dateFin) {
    return NextResponse.json({ error: 'date_debut et date_fin sont requis' }, { status: 400 })
  }

  const supabase = getServiceClient()
  const lignes = await getControleFacturation(supabase, dateDebut, dateFin)

  return NextResponse.json(lignes, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
