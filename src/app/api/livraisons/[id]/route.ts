export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Recalcule le statut du contrat achat et de ses contrats vente
// après toute modification de livraison (création, modification, suppression).
// Ferme si reliquat < 10t, RÉOUVRE si reliquat >= 10t et contrat était clos automatiquement.
async function recalculerStatutContrat(supabase: any, contratAchatId: string) {
  const { data: ca } = await supabase
    .from('contrats_achat')
    .select('id,statut,quantite_totale,contrats_vente(id,statut,quantite),livraisons(id,type,quantite_reelle,contrat_vente_id)')
    .eq('id', contratAchatId)
    .single()
  if (!ca) return

  const livreesCA = (ca.livraisons ?? [])
    .filter((l: any) => l.type === 'realisee' && l.quantite_reelle != null)
    .reduce((s: number, l: any) => s + l.quantite_reelle, 0)
  const reliquatCA = Math.max(0, (ca.quantite_totale ?? 0) - livreesCA)

  if (reliquatCA < 10 && ca.statut !== 'clos') {
    await supabase.from('contrats_achat').update({ statut: 'clos' }).eq('id', ca.id)
  } else if (reliquatCA >= 10 && ca.statut === 'clos') {
    await supabase.from('contrats_achat').update({ statut: 'en_cours' }).eq('id', ca.id)
  }

  for (const cv of (ca.contrats_vente ?? [])) {
    const livreeCV = (ca.livraisons ?? [])
      .filter((l: any) => l.type === 'realisee' && l.quantite_reelle != null && l.contrat_vente_id === cv.id)
      .reduce((s: number, l: any) => s + l.quantite_reelle, 0)
    const reliquatCV = Math.max(0, (cv.quantite ?? 0) - livreeCV)

    if (reliquatCV < 10 && cv.statut !== 'clos') {
      await supabase.from('contrats_vente').update({ statut: 'clos' }).eq('id', cv.id)
    } else if (reliquatCV >= 10 && cv.statut === 'clos') {
      await supabase.from('contrats_vente').update({ statut: 'en_cours' }).eq('id', cv.id)
    }
  }
}

// Quand une facture transport est saisie sur une livraison, met à jour (ou crée) automatiquement
// le tarif correspondant (transporteur + trajet) dans la grille "Tarifs transport" avec le prix réel constaté.
async function autoMajTarifTransport(supabase: any, livraison: any) {
  const montant = Number(livraison.montant_transport_reel)
  const quantite = Number(livraison.quantite_reelle)
  if (!livraison.transport_facture || !montant || !quantite || quantite <= 0) return

  let transporteurId = livraison.transporteur_id
  let lieuChargement = livraison.ville_chargement?.trim()
  let lieuDestination = livraison.ville_destination?.trim()

  if ((!transporteurId || !lieuChargement) && livraison.contrat_achat_id) {
    const { data: ca } = await supabase
      .from('contrats_achat')
      .select('transporteur_id,ville_chargement')
      .eq('id', livraison.contrat_achat_id)
      .single()
    transporteurId = transporteurId ?? ca?.transporteur_id
    lieuChargement = lieuChargement ?? ca?.ville_chargement?.trim()
  }
  // Pas de ville de destination saisie → repli sur le nom du silo ou la ville de l'agriculteur du contrat de vente lié
  if (!lieuDestination && livraison.contrat_vente_id) {
    const { data: cv } = await supabase
      .from('contrats_vente')
      .select('silo_nom,agriculteur:agriculteurs(ville_livraison)')
      .eq('id', livraison.contrat_vente_id)
      .single()
    lieuDestination = cv?.silo_nom?.trim() || (cv?.agriculteur as any)?.ville_livraison?.trim()
  }
  if (!transporteurId || !lieuChargement || !lieuDestination) return

  const prixParTonne = Math.round((montant / quantite) * 100) / 100
  const dateRef = livraison.date_facture_transport
    ? new Date(livraison.date_facture_transport).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR')
  const notes = `Auto — dernière facture le ${dateRef}`

  const { data: existant } = await supabase
    .from('tarifs_transport')
    .select('id')
    .eq('transporteur_id', transporteurId)
    .ilike('lieu_chargement', lieuChargement)
    .ilike('lieu_destination', lieuDestination)
    .maybeSingle()

  if (existant) {
    await supabase.from('tarifs_transport').update({ prix_par_tonne: prixParTonne, notes }).eq('id', existant.id)
  } else {
    await supabase.from('tarifs_transport').insert({
      transporteur_id: transporteurId,
      lieu_chargement: lieuChargement,
      lieu_destination: lieuDestination,
      prix_par_tonne: prixParTonne,
      notes,
    })
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

  if (data.contrat_achat_id) {
    await recalculerStatutContrat(supabase, data.contrat_achat_id)
  }
  if ('montant_transport_reel' in body || 'transport_facture' in body) {
    await autoMajTarifTransport(supabase, data)
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServiceClient()
  // Récupérer le contrat_achat_id avant suppression
  const { data: liv } = await supabase.from('livraisons').select('contrat_achat_id').eq('id', params.id).single()
  const { error } = await supabase.from('livraisons').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  // Recalculer après suppression
  if (liv?.contrat_achat_id) {
    await recalculerStatutContrat(supabase, liv.contrat_achat_id)
  }
  return NextResponse.json({ ok: true })
}
