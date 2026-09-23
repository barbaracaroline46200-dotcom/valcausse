export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib'
import { montantEnLettres } from '@/lib/nombre-lettres'

const black = rgb(0, 0, 0)
const PAGE_W = 595
const PAGE_H = 842
const PRIX_PART = 1.52

function fmtMontant(n: number) {
  // Helvetica (WinAnsi) ne sait pas encoder l'espace fine insecable (U+202F)
  // que toLocaleString('fr-FR') utilise comme separateur de milliers.
  const s = n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return s.replace(/ /g, ' ')
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
function fmtDateLettres(d: Date) {
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const nom = (searchParams.get('nom') ?? '').trim()
  const adresse = (searchParams.get('adresse') ?? '').trim()
  const montant = Number(searchParams.get('montant'))

  if (!nom || !adresse || !montant || montant <= 0) {
    return NextResponse.json({ error: 'Paramètres manquants (nom, adresse, montant requis)' }, { status: 400 })
  }

  const nbParts = Math.round(montant / PRIX_PART)
  const adresseLignes = adresse.split('\n').map(l => l.trim()).filter(Boolean)

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const page: PDFPage = pdfDoc.addPage([PAGE_W, PAGE_H])

  function centeredText(text: string, y: number, f: PDFFont, size: number) {
    const width = f.widthOfTextAtSize(text, size)
    page.drawText(text, { x: (PAGE_W - width) / 2, y, font: f, size, color: black })
  }

  function mixedLine(x: number, y: number, segments: { text: string; bold?: boolean }[], size = 10.5) {
    let cx = x
    for (const seg of segments) {
      const f = seg.bold ? fontBold : font
      page.drawText(seg.text, { x: cx, y, font: f, size, color: black })
      cx += f.widthOfTextAtSize(seg.text, size)
    }
  }

  function adresseBlockLignes(): string[] {
    return [nom.toUpperCase(), ...adresseLignes.map(l => l.toUpperCase())]
  }

  // ── En-tête : nom / adresse du détenteur, aligné à droite ──
  let y = PAGE_H - 70
  for (const ligne of adresseBlockLignes()) {
    const width = fontBold.widthOfTextAtSize(ligne, 11)
    page.drawText(ligne, { x: PAGE_W - 60 - width, y, font: fontBold, size: 11, color: black })
    y -= 16
  }

  // ── Titre ──
  y -= 40
  centeredText('ATTESTATION', y, fontBold, 20)
  y -= 26
  centeredText('CAPITAL SOCIAL', y, fontBold, 20)

  // ── Montant encadré ──
  y -= 50
  const montantLabel = `${fmtMontant(montant)} €`
  const montantSize = 16
  const montantWidth = fontBold.widthOfTextAtSize(montantLabel, montantSize)
  const boxPad = 12
  const boxX = (PAGE_W - montantWidth) / 2 - boxPad
  const boxW = montantWidth + boxPad * 2
  page.drawRectangle({ x: boxX, y: y - 8, width: boxW, height: montantSize + 16, borderColor: black, borderWidth: 1 })
  page.drawText(montantLabel, { x: (PAGE_W - montantWidth) / 2, y, font: fontBold, size: montantSize, color: black })

  // ── Corps ──
  y -= 70
  page.drawText('Je soussigné, Thierry CHASSAING, Président de la Coopérative Agricole', { x: 60, y, font, size: 10.5, color: black })
  y -= 15
  page.drawText('VALCAUSSE, certifie que :', { x: 60, y, font, size: 10.5, color: black })

  y -= 40
  for (const ligne of adresseBlockLignes()) {
    centeredText(ligne, y, fontBold, 10.5)
    y -= 16
  }

  y -= 20
  mixedLine(60, y, [
    { text: 'détient ' },
    { text: `${nbParts} parts sociales de ${fmtMontant(PRIX_PART)}€`, bold: true },
    { text: ' au sein de la Coopérative VALCAUSSE,' },
  ])
  y -= 18
  mixedLine(60, y, [
    { text: `soit un Capital Social de ${fmtMontant(montant)}€`, bold: true },
    { text: ` (${montantEnLettres(montant)}).` },
  ])

  // ── Signature ──
  y -= 90
  const sigX = PAGE_W - 200
  page.drawText('Souillac,', { x: sigX, y, font, size: 10.5, color: black })
  y -= 15
  page.drawText(`le ${fmtDateLettres(new Date())}`, { x: sigX, y, font, size: 10.5, color: black })
  y -= 45
  page.drawText('Thierry CHASSAING', { x: sigX, y, font, size: 10.5, color: black })
  y -= 15
  page.drawText('Président', { x: sigX, y, font, size: 10.5, color: black })

  const pdfBytes = await pdfDoc.save()
  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="attestation-capital-${nom.replace(/[^a-z0-9]+/gi, '-')}.pdf"`,
    },
  })
}
