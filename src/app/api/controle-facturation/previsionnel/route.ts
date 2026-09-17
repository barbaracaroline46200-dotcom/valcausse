export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { getPrevisionnelFournisseur } from '@/lib/controle-facturation'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateFin = searchParams.get('date_fin')
  if (!dateFin) {
    return NextResponse.json({ error: 'date_fin est requis' }, { status: 400 })
  }

  const supabase = getServiceClient()
  const lignes = await getPrevisionnelFournisseur(supabase, dateFin)

  return NextResponse.json(lignes, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
