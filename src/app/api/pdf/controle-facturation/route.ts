export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import {
  getControleFacturation, trierLignes, filtrerLignes, STATUTS,
  type LigneControle, type TriChamp, type Ordre, type FiltresControle, type StatutFacturation,
} from '@/lib/controle-facturation'
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib'

const brun = rgb(0.482, 0.157, 0.125)
const or = rgb(0.784, 0.580, 0.102)
const gray = rgb(0.4, 0.4, 0.4)
const black = rgb(0, 0, 0)
const red = rgb(0.863, 0.149, 0.149)

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}
function statutInfo(key: StatutFacturation) {
  return STATUTS.find(s => s.key === key) ?? STATUTS[0]
}
const PAGE_W = 842
const PAGE_H = 595
const MARGIN_BOTTOM = 55
const LINE_H = 10
const ROW_PAD = 6

function fmtTonnes(n: number | null | undefined) {
  // Helvetica (WinAnsi) ne sait pas encoder l'espace fine insecable (U+202F)
  // que toLocaleString('fr-FR') utilise comme separateur de milliers.
  const s = (n ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return s.replace(/ /g, ' ') + ' t'
}
function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}
function fmtEcart(l: LigneControle) {
  if (l.ecartMois == null) return '—'
  if (l.ecartMois === 0) return '0'
  return l.ecartMois > 0 ? `+${l.ecartMois} mois` : `${l.ecartMois} mois`
}

const TRI_VALIDES: TriChamp[] = ['date', 'fournisseur', 'contrat', 'produit', 'ecart']

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateDebut = searchParams.get('date_debut')
  const dateFin = searchParams.get('date_fin')
  if (!dateDebut || !dateFin) {
    return NextResponse.json({ error: 'date_debut et date_fin sont requis' }, { status: 400 })
  }
  const triParam = searchParams.get('tri') as TriChamp | null
  const tri: TriChamp = triParam && TRI_VALIDES.includes(triParam) ? triParam : 'date'
  const ordre: Ordre = searchParams.get('ordre') === 'desc' ? 'desc' : 'asc'
  const filtres: FiltresControle = {
    fournisseur: searchParams.get('fournisseur') || undefined,
    produit: searchParams.get('produit') || undefined,
    contrat: searchParams.get('contrat') || undefined,
    statut: (searchParams.get('statut') as FiltresControle['statut']) || '',
  }

  const supabase = getServiceClient()
  const brut = await getControleFacturation(supabase, dateDebut, dateFin)
  const lignes = trierLignes(filtrerLignes(brut, filtres), tri, ordre)
  const nbEcarts = lignes.filter(l => l.statut === 'mois_different').length

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let page: PDFPage = pdfDoc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - 50

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN_BOTTOM) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - 50
    }
  }

  function drawHeader() {
    page.drawRectangle({ x: 0, y: y - 15, width: PAGE_W, height: 75, color: rgb(0.992, 0.961, 0.953) })
    page.drawRectangle({ x: 0, y: y - 15, width: 6, height: 75, color: brun })
    page.drawText('VALCAUSSE', { x: 28, y, font: fontBold, size: 22, color: brun })
    page.drawText('coopérative agricole', { x: 28, y: y - 18, font, size: 10, color: or })
    page.drawText('CONTRÔLE FACTURATION FOURNISSEUR', { x: PAGE_W - 340, y, font: fontBold, size: 14, color: brun })
    page.drawText(`Livraisons du ${fmtDate(dateDebut)} au ${fmtDate(dateFin)}`, { x: PAGE_W - 340, y: y - 18, font, size: 10, color: gray })
    y -= 60
    page.drawLine({ start: { x: 50, y }, end: { x: PAGE_W - 50, y }, thickness: 1.5, color: or })
    y -= 22
  }
  drawHeader()

  function drawLegend() {
    ensureSpace(20)
    let x = 50
    page.drawText('Légende :', { x, y, font: fontBold, size: 8, color: gray })
    x += 46
    STATUTS.forEach(s => {
      const color = hexToRgb(s.hex)
      page.drawRectangle({ x, y: y - 1, width: 8, height: 8, color })
      page.drawText(s.label, { x: x + 12, y, font, size: 8, color: gray })
      x += 12 + font.widthOfTextAtSize(s.label, 8) + 16
    })
    y -= 20
    const filtresActifs = [
      filtres.fournisseur && `Fournisseur : ${filtres.fournisseur}`,
      filtres.produit && `Produit : ${filtres.produit}`,
      filtres.contrat && `Contrat : ${filtres.contrat}`,
      filtres.statut && `Statut : ${statutInfo(filtres.statut).label}`,
    ].filter(Boolean)
    if (filtresActifs.length) {
      ensureSpace(16)
      page.drawText(`Filtres actifs — ${filtresActifs.join(' · ')}`, { x: 50, y, font, size: 8, color: brun })
      y -= 16
    }
  }
  drawLegend()

  if (nbEcarts > 0) {
    ensureSpace(20)
    page.drawText(
      `ATTENTION — ${nbEcarts} livraison${nbEcarts > 1 ? 's' : ''} facturée${nbEcarts > 1 ? 's' : ''} sur un mois différent de la livraison : voir colonne "Écart".`,
      { x: 50, y, font: fontBold, size: 9.5, color: red }
    )
    y -= 20
  }

  function sectionTitle(title: string, subtitle?: string) {
    ensureSpace(subtitle ? 46 : 35)
    y -= 4
    page.drawText(title, { x: 50, y, font: fontBold, size: 11, color: brun })
    y -= 8
    page.drawLine({ start: { x: 50, y }, end: { x: PAGE_W - 50, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
    y -= 16
    if (subtitle) {
      page.drawText(subtitle, { x: 50, y, font, size: 8, color: gray })
      y -= 14
    }
  }

  const COLS = [
    { key: 'date', label: 'Livrée le', x: 54, w: 55 },
    { key: 'fournisseur', label: 'Fournisseur', x: 112, w: 88 },
    { key: 'produit', label: 'Produit', x: 203, w: 85 },
    { key: 'contrat', label: 'N° Contrat', x: 291, w: 78 },
    { key: 'quantite', label: 'Quantité', x: 372, w: 50 },
    { key: 'numeroFacture', label: 'N° Facture', x: 425, w: 105 },
    { key: 'dateFacture', label: 'Facturée le', x: 533, w: 55 },
    { key: 'ecart', label: 'Écart', x: 591, w: 60 },
    { key: 'statut', label: 'Statut', x: 654, w: 138 },
  ]

  function tableHeader() {
    ensureSpace(20)
    COLS.forEach(c => page.drawText(c.label, { x: c.x, y, font: fontBold, size: 8.5, color: gray }))
    y -= 12
    page.drawLine({ start: { x: 50, y: y + 4 }, end: { x: PAGE_W - 50, y: y + 4 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    y -= 4
  }

  // Les champs libres (noms saisis à la main) peuvent contenir des caractères
  // que la police standard WinAnsi ne sait pas encoder. On neutralise tout ce
  // que la police ne sait pas encoder plutôt que de traquer les caractères un
  // par un.
  function sanitizeForPdf(s: string, size = 8.5): string {
    const cleaned = s.replace(/[\r\n\t]+/g, ' ')
    try {
      font.widthOfTextAtSize(cleaned, size)
      return cleaned
    } catch {
      let result = ''
      for (const ch of cleaned) {
        try {
          font.widthOfTextAtSize(ch, size)
          result += ch
        } catch {
          result += ' '
        }
      }
      return result.replace(/\s+/g, ' ').trim()
    }
  }

  function wrapLines(rawText: string, maxWidth: number, size = 8.5, maxLines = 2): string[] {
    const text = (rawText || '').trim()
    if (!text) return ['']
    const words = text.split(/\s+/)
    const allLines: string[] = []
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate
        continue
      }
      if (current) allLines.push(current)
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word
      } else {
        current = ''
        for (const ch of word) {
          const cand = current + ch
          if (font.widthOfTextAtSize(cand, size) <= maxWidth) current = cand
          else { allLines.push(current); current = ch }
        }
      }
    }
    if (current) allLines.push(current)
    if (allLines.length === 0) allLines.push('')

    if (allLines.length <= maxLines) return allLines
    const shown = allLines.slice(0, maxLines)
    let last = shown[maxLines - 1]
    while (last.length > 0 && font.widthOfTextAtSize(last + '…', size) > maxWidth) {
      last = last.slice(0, -1)
    }
    shown[maxLines - 1] = last + '…'
    return shown
  }

  function tableRow(l: LigneControle) {
    const s = statutInfo(l.statut)
    const statutColor = hexToRgb(s.hex)
    const values: Record<string, string> = {
      date: fmtDate(l.dateLivraison),
      fournisseur: sanitizeForPdf(l.fournisseur),
      produit: sanitizeForPdf(l.produit),
      contrat: sanitizeForPdf(l.numeroContrat),
      quantite: l.quantite != null ? fmtTonnes(l.quantite) : '—',
      numeroFacture: sanitizeForPdf(l.numeroFacture ?? '—'),
      dateFacture: fmtDate(l.dateFacture),
      ecart: fmtEcart(l),
      statut: sanitizeForPdf(s.label),
    }
    const linesByCol: Record<string, string[]> = {}
    let maxLines = 1
    COLS.forEach(c => {
      const lines = wrapLines(values[c.key] ?? '—', c.w - 8)
      linesByCol[c.key] = lines
      maxLines = Math.max(maxLines, lines.length)
    })
    const rowHeight = maxLines * LINE_H + ROW_PAD
    ensureSpace(rowHeight)

    // Bandeau couleur en début de ligne = statut (voir légende)
    page.drawRectangle({ x: 44, y: y - rowHeight + ROW_PAD - 1, width: 4, height: rowHeight - 3, color: statutColor })

    COLS.forEach(c => {
      const lines = linesByCol[c.key]
      lines.forEach((line, i) => {
        page.drawText(line, {
          x: c.x, y: y - i * LINE_H, font: c.key === 'ecart' && l.ecartMois ? fontBold : font,
          size: 8.5,
          color: c.key === 'ecart' && l.ecartMois ? red : black,
        })
      })
    })
    y -= rowHeight
  }

  sectionTitle(
    `LIVRAISONS (${lignes.length})`,
    'Une ligne par livraison réalisée avec contrat d\'achat. "Écart" = décalage en mois entre la date de livraison et la date de la facture fournisseur.'
  )
  if (lignes.length === 0) {
    page.drawText('Aucune livraison sur cette période (ou filtrée par les critères actifs).', { x: 50, y, font, size: 9, color: gray })
    y -= 16
  } else {
    tableHeader()
    for (const l of lignes) tableRow(l)
    ensureSpace(16)
    const total = lignes.reduce((s, l) => s + (l.quantite ?? 0), 0)
    page.drawText(`Total : ${fmtTonnes(total)}`, { x: 50, y, font: fontBold, size: 9, color: brun })
    y -= 20
  }

  // Pied de page
  const pages = pdfDoc.getPages()
  pages.forEach((p, i) => {
    p.drawText(`Édité le ${new Date().toLocaleDateString('fr-FR')} — page ${i + 1}/${pages.length}`, {
      x: 50, y: 28, font, size: 8, color: gray,
    })
  })

  const pdfBytes = await pdfDoc.save()

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="controle-facturation-${dateDebut}_${dateFin}.pdf"`,
    },
  })
}
