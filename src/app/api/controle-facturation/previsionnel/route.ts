export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { getPrevisionnelFournisseur } from '@/lib/controle-facturation'

export async function GET() {
  const supabase = getServiceClient()
  const lignes = await getPrevisionnelFournisseur(supabase)

  return NextResponse.json(lignes, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
