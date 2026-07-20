export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const idsParam = searchParams.get('livraison_ids')
  const ids = idsParam?.split(',').filter(Boolean) ?? []
  if (ids.length === 0) return NextResponse.json({ error: 'Missing livraison_ids' }, { status: 400 })

  const supabase = getServiceClient()
  const { data: livraisons, error } = await supabase
    .from('livraisons')
    .select(`
      *,
      contrat_achat:contrats_achat(
        *,
        produit:produits(nom),
        fournisseur:fournisseurs(*,points_chargement(*)),
        courtier:courtiers(*),
        transporteur:transporteurs(nom),
        contrats_vente(id,destination_silo,agriculteur:agriculteurs(*))
      )
    `)
    .in('id', ids)

  if (error || !livraisons || livraisons.length === 0) return NextResponse.json({ error: 'Livraisons not found' }, { status: 404 })

  // Ordonner selon l'ordre reçu, garder les infos communes de la première livraison
  const livs = ids.map(id => livraisons.find((l: any) => l.id === id)).filter(Boolean) as any[]
  const first = livs[0]
  const ca = first.contrat_achat as any

  function agriculteurDe(l: any) {
    const contrats_vente: any[] = l.contrat_achat?.contrats_vente ?? []
    const cv = contrats_vente.find((v: any) => v.id === l.contrat_vente_id)
    return cv?.agriculteur
  }

  const totalTonnes = livs.reduce((sum, l) => sum + (Number(l.quantite_prevue) || 0), 0)

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const brun = rgb(0.482, 0.157, 0.125)
  const or   = rgb(0.784, 0.580, 0.102)
  const gray = rgb(0.4, 0.4, 0.4)
  const black = rgb(0, 0, 0)

  let y = height - 50

  page.drawRectangle({ x: 0, y: y - 15, width, height: 75, color: rgb(0.992, 0.961, 0.953) })
  page.drawRectangle({ x: 0, y: y - 15, width: 6, height: 75, color: brun })
  page.drawText('VALCAUSSE', { x: 28, y, font: fontBold, size: 22, color: brun })
  page.drawText('coopérative agricole', { x: 28, y: y - 18, font, size: 10, color: or })
  page.drawText('ORDRE DE TRANSPORT GROUPÉ', { x: width - 280, y, font: fontBold, size: 14, color: brun })
  y -= 60

  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1.5, color: or })
  y -= 25

  function row(label: string, value: string, bold = false) {
    page.drawText(label, { x: 50, y, font, size: 10, color: gray })
    page.drawText(value || '—', { x: 220, y, font: bold ? fontBold : font, size: 10, color: black })
    y -= 20
  }

  row('Produit', ca?.produit?.nom ?? '—', true)
  row(`${livs.length} livraisons`, `soit ${totalTonnes.toLocaleString('fr-FR')} tonnes au total`, true)
  y -= 5

  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) })
  y -= 15

  page.drawText('FOURNISSEUR', { x: 50, y, font: fontBold, size: 10, color: brun })
  y -= 18
  row('Nom', ca?.fournisseur?.nom ?? '—')
  row('Référence contrat', ca?.reference_fournisseur ?? '—')
  row('N° contrat interne', ca?.numero_contrat ?? '—')
  if (ca?.courtier) {
    row('Courtier', `${ca.courtier.nom}${ca.courtier.numero_courtier ? ` (n° ${ca.courtier.numero_courtier})` : ''}`)
  }
  y -= 5

  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) })
  y -= 15

  page.drawText('LIEU D\'ENLÈVEMENT', { x: 50, y, font: fontBold, size: 10, color: brun })
  y -= 18
  const lieuEnlevement = first.ville_chargement || ca?.ville_chargement || '—'
  const lieuLines = lieuEnlevement.split('\n').flatMap((line: string) => {
    const maxLen = 60
    if (line.length <= maxLen) return [line]
    const chunks: string[] = []
    for (let i = 0; i < line.length; i += maxLen) chunks.push(line.slice(i, i + maxLen))
    return chunks
  })
  lieuLines.forEach((line: string) => {
    page.drawText(line, { x: 220, y, font, size: 10, color: black })
    y -= 16
  })
  y -= 10

  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) })
  y -= 15

  // Détail des livraisons
  page.drawText('DÉTAIL DES LIVRAISONS', { x: 50, y, font: fontBold, size: 10, color: brun })
  y -= 18

  const colX = { periode: 50, qte: 210, dest: 300 }
  page.drawText('Période souhaitée', { x: colX.periode, y, font: fontBold, size: 9, color: gray })
  page.drawText('Quantité', { x: colX.qte, y, font: fontBold, size: 9, color: gray })
  page.drawText('Destination', { x: colX.dest, y, font: fontBold, size: 9, color: gray })
  y -= 14
  page.drawLine({ start: { x: 50, y: y + 4 }, end: { x: width - 50, y: y + 4 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })

  for (const l of livs) {
    const periode = l.date_souhaitee
      ? new Date(l.date_souhaitee).toLocaleDateString('fr-FR')
      : l.semaine_souhaitee || '—'
    const agriculteur = agriculteurDe(l)
    const dest = agriculteur ? [agriculteur.civilite, agriculteur.nom].filter(Boolean).join(' ') : (l.ville_destination ?? '—')
    page.drawText(periode, { x: colX.periode, y, font, size: 9.5, color: black })
    page.drawText(`${l.quantite_prevue ?? '—'} t`, { x: colX.qte, y, font, size: 9.5, color: black })
    page.drawText(dest || '—', { x: colX.dest, y, font, size: 9.5, color: black })
    y -= 16
    if (y < 160) { // sécurité anti-débordement, peu probable avec des lots raisonnables
      y -= 10
    }
  }

  y -= 6
  page.drawLine({ start: { x: 50, y: y + 4 }, end: { x: width - 50, y: y + 4 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
  y -= 14
  page.drawText('TOTAL', { x: colX.periode, y, font: fontBold, size: 10, color: brun })
  page.drawText(`${totalTonnes.toLocaleString('fr-FR')} t`, { x: colX.qte, y, font: fontBold, size: 10, color: brun })
  y -= 25

  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: brun })
  y -= 20

  const noteLines = [
    '!  RAPPELS IMPORTANTS',
    '',
    '- Appelez l\'agriculteur plusieurs heures avant chaque livraison pour',
    '  convenir de l\'heure exacte et vous assurer de sa disponibilite.',
    '',
    '- Verifiez que votre materiel est adapte au site de chargement',
    '  ET a chaque site de dechargement (benne, citerne, dimensions, acces...).',
  ]
  const noteBlockHeight = noteLines.length * 16 + 24
  page.drawRectangle({ x: 50, y: y - noteBlockHeight + 16, width: width - 100, height: noteBlockHeight, color: rgb(1, 0.941, 0.902) })
  page.drawRectangle({ x: 50, y: y - noteBlockHeight + 16, width: 5, height: noteBlockHeight, color: brun })
  noteLines.forEach((line, i) => {
    const isTitle = i === 0
    page.drawText(line, {
      x: 62,
      y: y - i * 16,
      font: isTitle ? fontBold : font,
      size: isTitle ? 11 : 9.5,
      color: isTitle ? brun : black,
    })
  })
  y -= noteBlockHeight + 15
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: gray })
  y -= 15

  const nomTransporteur = ca?.transporteur?.nom ?? '—'
  const dateEnvoi = new Date().toLocaleDateString('fr-FR')
  page.drawText(`Transporteur : ${nomTransporteur} — Envoyé le ${dateEnvoi}`, {
    x: 50, y, font, size: 8, color: gray
  })

  const pdfBytes = await pdfDoc.save()

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ordre-transport-groupe-${ca?.numero_contrat ?? 'multi'}.pdf"`,
    },
  })
}
