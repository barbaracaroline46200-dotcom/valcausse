export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib'
import { montantEnLettres } from '@/lib/nombre-lettres'

const black = rgb(0, 0, 0)
const PAGE_W = 595.32
const PAGE_H = 841.92
const PRIX_PART = 1.52

// Positions calibrées sur le modèle papier original (coordonnées relevées via
// `pdftotext -bbox`) pour que le bloc destinataire tombe dans la fenêtre de
// l'enveloppe : x fixe (pas d'alignement dynamique à droite) et y fixe depuis
// le haut de la page, indépendant du nombre de lignes d'adresse saisies.
const HEADER_X = 319
const HEADER_Y_START = 700
const LINE_H = 17.1
const BODY_X = 71
const BODY_INDENT_X = 99
const SIGNATURE_X = 354
const TITLE_Y1 = 620
const TITLE_Y2 = 590.6
const BOX_Y = 543.3
const BODY_Y1 = 457.4
const BODY_Y2 = 440.3
const GAP_BODY_TO_MIDBLOCK = 34.2
const GAP_MIDBLOCK_TO_DETIENT = 34.2
const GAP_SOIT_TO_SIGNATURE = 68.3
const GAP_BLANC_SIGNATURE = 34.2

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
  const adresseLignes = [nom.toUpperCase(), ...adresse.split('\n').map(l => l.trim()).filter(Boolean).map(l => l.toUpperCase())]

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const page: PDFPage = pdfDoc.addPage([PAGE_W, PAGE_H])

  function centeredText(text: string, y: number, f: PDFFont, size: number) {
    const width = f.widthOfTextAtSize(text, size)
    page.drawText(text, { x: (PAGE_W - width) / 2, y, font: f, size, color: black })
  }

  function mixedLine(x: number, y: number, segments: { text: string; bold?: boolean }[], size = 11) {
    let cx = x
    for (const seg of segments) {
      const f = seg.bold ? fontBold : font
      page.drawText(seg.text, { x: cx, y, font: f, size, color: black })
      cx += f.widthOfTextAtSize(seg.text, size)
    }
  }

  // ── En-tête : bloc destinataire, position fixe (fenêtre enveloppe) ──
  let y = HEADER_Y_START
  for (const ligne of adresseLignes) {
    page.drawText(ligne, { x: HEADER_X, y, font: fontBold, size: 11, color: black })
    y -= LINE_H
  }

  // ── Titre ──
  centeredText('ATTESTATION', TITLE_Y1, fontBold, 20)
  centeredText('CAPITAL SOCIAL', TITLE_Y2, fontBold, 20)

  // ── Montant encadré ──
  const montantLabel = `${fmtMontant(montant)} €`
  const montantSize = 16
  const montantWidth = fontBold.widthOfTextAtSize(montantLabel, montantSize)
  const boxPad = 12
  const boxX = (PAGE_W - montantWidth) / 2 - boxPad
  const boxW = montantWidth + boxPad * 2
  page.drawRectangle({ x: boxX, y: BOX_Y - 8, width: boxW, height: montantSize + 16, borderColor: black, borderWidth: 1 })
  page.drawText(montantLabel, { x: (PAGE_W - montantWidth) / 2, y: BOX_Y, font: fontBold, size: montantSize, color: black })

  // ── Corps ──
  page.drawText('Je soussigné, Thierry CHASSAING, Président de la Coopérative Agricole', { x: BODY_INDENT_X, y: BODY_Y1, font, size: 11, color: black })
  page.drawText('VALCAUSSE, certifie que :', { x: BODY_X, y: BODY_Y2, font, size: 11, color: black })

  y = BODY_Y2 - GAP_BODY_TO_MIDBLOCK
  for (const ligne of adresseLignes) {
    centeredText(ligne, y, fontBold, 11)
    y -= LINE_H
  }

  y -= (GAP_MIDBLOCK_TO_DETIENT - LINE_H)
  mixedLine(BODY_X, y, [
    { text: 'détient ' },
    { text: `${nbParts} parts sociales de ${fmtMontant(PRIX_PART)}€`, bold: true },
    { text: ' au sein de la Coopérative VALCAUSSE,' },
  ])
  const soitY = y - LINE_H
  mixedLine(BODY_X, soitY, [
    { text: `soit un Capital Social de ${fmtMontant(montant)}€`, bold: true },
    { text: ` (${montantEnLettres(montant)}).` },
  ])

  // ── Signature ──
  y = soitY - GAP_SOIT_TO_SIGNATURE
  page.drawText('Souillac,', { x: SIGNATURE_X, y, font, size: 11, color: black })
  y -= LINE_H
  page.drawText(`le ${fmtDateLettres(new Date())}`, { x: SIGNATURE_X, y, font, size: 11, color: black })
  y -= GAP_BLANC_SIGNATURE
  page.drawText('Thierry CHASSAING', { x: SIGNATURE_X, y, font, size: 11, color: black })
  y -= LINE_H
  page.drawText('Président', { x: SIGNATURE_X, y, font, size: 11, color: black })

  const pdfBytes = await pdfDoc.save()
  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="attestation-capital-${nom.replace(/[^a-z0-9]+/gi, '-')}.pdf"`,
    },
  })
}
