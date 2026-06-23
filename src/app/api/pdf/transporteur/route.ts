export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const livraisonId = searchParams.get('livraison_id')
  if (!livraisonId) return NextResponse.json({ error: 'Missing livraison_id' }, { status: 400 })

  const supabase = getServiceClient()
  const { data: liv, error } = await supabase
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
    .eq('id', livraisonId)
    .single()

  if (error || !liv) return NextResponse.json({ error: 'Livraison not found' }, { status: 404 })

  const ca = liv.contrat_achat as any
  const contratVenteId = (liv as any).contrat_vente_id
  const contrats_vente: any[] = ca?.contrats_vente ?? []
  const cv = contrats_vente.find((v: any) => v.id === contratVenteId)
  const agriculteur = cv?.agriculteur

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Couleurs Valcausse officielles
  const brun = rgb(0.482, 0.157, 0.125)   // #7B2820
  const or   = rgb(0.784, 0.580, 0.102)   // #C8941A
  const bleu = rgb(0.267, 0.541, 0.710)   // #448ab5
  const gray = rgb(0.4, 0.4, 0.4)
  const black = rgb(0, 0, 0)

  let y = height - 50

  // Header — fond brun Valcausse
  page.drawRectangle({ x: 0, y: y - 15, width, height: 75, color: rgb(0.992, 0.961, 0.953) })
  page.drawRectangle({ x: 0, y: y - 15, width: 6, height: 75, color: brun })

  // Logo texte
  page.drawText('VALCAUSSE', { x: 28, y, font: fontBold, size: 22, color: brun })
  page.drawText('coopérative agricole', { x: 28, y: y - 18, font, size: 10, color: or })
  page.drawText('ORDRE DE TRANSPORT', { x: width - 230, y, font: fontBold, size: 14, color: brun })
  y -= 60

  // Separator
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1.5, color: or })
  y -= 25

  function row(label: string, value: string, bold = false) {
    page.drawText(label, { x: 50, y, font, size: 10, color: gray })
    page.drawText(value || '—', { x: 220, y, font: bold ? fontBold : font, size: 10, color: black })
    y -= 20
  }

  row('Produit', ca?.produit?.nom ?? '—', true)
  row('Quantité prévue', `${liv.quantite_prevue ?? '—'} tonnes`, true)
  y -= 5

  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) })
  y -= 15

  const souhaitAgri = liv.date_souhaitee
    ? new Date(liv.date_souhaitee).toLocaleDateString('fr-FR')
    : (liv as any).semaine_souhaitee
      ? (liv as any).semaine_souhaitee
      : '—'
  row('Période souhaitée (agri)', souhaitAgri)
  y -= 5

  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) })
  y -= 15

  // Fournisseur
  page.drawText('FOURNISSEUR', { x: 50, y, font: fontBold, size: 10, color: brun })
  y -= 18
  row('Nom', ca?.fournisseur?.nom ?? '—')
  row('Référence contrat', ca?.reference_fournisseur ?? '—')
  row('N° contrat interne', ca?.numero_contrat ?? '—')
  if (ca?.courtier) {
    row('Courtier', `${ca.courtier.nom}${ca.courtier.numero_courtier ? ` (n° ${ca.courtier.numero_courtier})` : ''}`)
  }
  if (ca?.famille === 'appro' && liv.numero_mise_a_disposition) {
    row('N° mise à disposition', liv.numero_mise_a_disposition)
  }
  y -= 5

  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) })
  y -= 15

  // Lieu d'enlèvement (texte libre multiligne)
  page.drawText('LIEU D\'ENLÈVEMENT', { x: 50, y, font: fontBold, size: 10, color: brun })
  y -= 18
  const lieuEnlevement = liv.ville_chargement || ca?.ville_chargement || '—'
  const lieuLines = lieuEnlevement.split('\n').flatMap((line: string) => {
    // Couper les lignes trop longues (> ~60 chars)
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
  y -= 5

  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) })
  y -= 15

  // Destination
  page.drawText('ADRESSE DE DESTINATION', { x: 50, y, font: fontBold, size: 10, color: brun })
  y -= 18
  if (agriculteur) {
    row('Nom', [agriculteur.civilite, agriculteur.nom].filter(Boolean).join(' ') || '—')
    if (agriculteur.adresse_livraison) row('Adresse', agriculteur.adresse_livraison)
    if (agriculteur.ville_livraison) row('Ville', agriculteur.ville_livraison)
    if (agriculteur.telephone) row('Téléphone', agriculteur.telephone)
  } else {
    row('Destination', liv.ville_destination ?? '—')
  }

  // Note transport agriculteur
  if (agriculteur?.note_transport) {
    y -= 10
    page.drawRectangle({ x: 50, y: y - 8, width: width - 100, height: 20 + Math.ceil(agriculteur.note_transport.length / 60) * 16, color: rgb(1, 0.973, 0.882) })
    page.drawText('⚠ NOTE TRANSPORT', { x: 55, y, font: fontBold, size: 9, color: or })
    y -= 16
    const noteLines = agriculteur.note_transport.split('\n').flatMap((line: string) => {
      const maxLen = 75
      if (line.length <= maxLen) return [line]
      const chunks: string[] = []
      for (let i = 0; i < line.length; i += maxLen) chunks.push(line.slice(i, i + maxLen))
      return chunks
    })
    noteLines.forEach((line: string) => {
      page.drawText(line, { x: 55, y, font: fontBold, size: 9, color: black })
      y -= 14
    })
    y -= 5
  }

  y -= 20
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: brun })
  y -= 20

  // Encadré d'avertissement transporteur
  const noteLines = [
    '⚠  RAPPELS IMPORTANTS',
    '',
    '• Appelez l\'agriculteur plusieurs heures avant la livraison pour',
    '  convenir de l\'heure exacte et vous assurer de sa disponibilité.',
    '',
    '• Vérifiez que votre matériel est adapté au site de chargement',
    '  ET au site de déchargement (benne, citerne, dimensions, accès…).',
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
      'Content-Disposition': `attachment; filename="ordre-transport-${ca?.numero_contrat ?? livraisonId}.pdf"`,
    },
  })
}
