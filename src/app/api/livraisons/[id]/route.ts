export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

async function autoCloreContrat(supabase: any, contratAchatId: string) {
  const { data: ca } = await supabase
    .from('contrats_achat')
    .select('id,statut,quantite_totale,contrats_vente(id,statut,quantite),livraisons(id,type,quantite_reelle,contrat_vente_id)')
    .eq('id', contratAchatId)
    .single()
  if (!ca) return

  const livreesCA = (ca.livraisons ?? [])
    .filter((l: any) => l.type === 'realisee' && l.quantite_reelle != null)
    .reduce((s: number, l: any) => s + l.quantite_reelle, 0)
  const reliquatCA = Math.max(0, ca.quantite_totale - livreesCA)
  if (reliquatCA < 10 && ca.statut !== 'clos') {
    await supabase.from('contrats_achat').update({ statut: 'clos' }).eq('id', ca.id)
  }

  for (const cv of (ca.contrats_vente ?? [])) {
    if (cv.statut === 'clos') continue
    const livreeCV = (ca.livraisons ?? [])
      .filter((l: any) => l.type === 'realisee' && l.quantite_reelle != null && l.contrat_vente_id === cv.id)
      .reduce((s: number, l: any) => s + l.quantite_reelle, 0)
    const reliquatCV = Math.max(0, cv.quantite - livreeCV)
    if (reliquatCV < 10) {
      await supabase.from('contrats_vente').update({ statut: 'clos' }).eq('id', cv.id)
    }
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('livraisons')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (data.type === 'realisee' && data.contrat_achat_id) {
    await autoCloreContrat(supabase, data.contrat_achat_id)
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceClient()
  const { error } = await supabase.from('livraisons').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
