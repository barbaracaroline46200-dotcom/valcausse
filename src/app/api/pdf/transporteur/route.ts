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
        contrats_vente(agriculteur:agriculteurs(*))
      )
    `)
    .eq('id', livraisonId)
    .single()

  if (error || !liv) return NextResponse.json({ error: 'Livraison not found' }, { status: 404 })

  const ca = liv.contrat_achat as any
  const agriculteur = ca?.contrats_vente?.[0]?.agriculteur

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

  row('Date de livraison souhaitée', liv.mois_prevu ? new Date(liv.mois_prevu).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '—')
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
  if (ca?.famille === 'appro' && ca?.numero_mise_a_disposition) {
    row('N° mise à disposition', ca.numero_mise_a_disposition)
  }
  y -= 5

  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) })
  y -= 15

  // Chargement
  page.drawText('ADRESSE D\'ENLÈVEMENT', { x: 50, y, font: fontBold, size: 10, color: brun })
  y -= 18
  const adresseEnlevement = liv.ville_chargement || ca?.point_chargement || ca?.fournisseur?.adresse || '—'
  const lines = adresseEnlevement.split('\n')
  lines.forEach((line: string) => {
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
    row('Nom', agriculteur.nom)
    if (agriculteur.adresse_livraison) row('Adresse', agriculteur.adresse_livraison)
    if (agriculteur.ville_livraison) row('Ville', agriculteur.ville_livraison)
  } else {
    row('Destination', liv.ville_destination ?? '—')
  }

  y -= 20
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: brun })
  y -= 20

  page.drawText('Bon de transport généré automatiquement — Valcausse', {
    x: 50, y, font, size: 8, color: gray
  })
  page.drawText(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, {
    x: width - 200, y, font, size: 8, color: gray
  })

  const pdfBytes = await pdfDoc.save()

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ordre-transport-${ca?.numero_contrat ?? livraisonId}.pdf"`,
    },
  })
}
