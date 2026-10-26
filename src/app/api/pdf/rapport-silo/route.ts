export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import {
  getRapportSilo, filtrerLignesSilo, grouperParMois, totauxParProduit, TYPES_SILO,
  type LigneRapportSilo, type FiltresRapportSilo, type TypeSilo,
} from '@/lib/rapport-silo'
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib'

const brun = rgb(0.482, 0.157, 0.125)
const or = rgb(0.784, 0.580, 0.102)
const gray = rgb(0.4, 0.4, 0.4)
const black = rgb(0, 0, 0)

const PAGE_W = 842
const PAGE_H = 595
const MARGIN_BOTTOM = 55
const LINE_H = 10
const ROW_PAD = 6

function fmtTonnes(n: number | null | undefined) {
  const s = (n ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return s.replace(/ /g, ' ') + ' t'
}
function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}
function fmtLigneDate(l: LigneRapportSilo) {
  return l.date ? fmtDate(l.date) : (l.periodeLabel || '—')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateDebut = searchParams.get('date_debut')
  const dateFin = searchParams.get('date_fin')
  if (!dateDebut || !dateFin) {
    return NextResponse.json({ error: 'date_debut et date_fin sont requis' }, { status: 400 })
  }
  const produitsParam = searchParams.get('produits')
  const fournisseursParam = searchParams.get('fournisseurs')
  const typesSiloParam = searchParams.get('types_silo')
  const filtres: FiltresRapportSilo = {
    produits: produitsParam ? produitsParam.split(',').filter(Boolean) : undefined,
    fournisseurs: fournisseursParam ? fournisseursParam.split(',').filter(Boolean) : undefined,
    typesSilo: typesSiloParam
      ? (typesSiloParam.split(',').filter((t): t is TypeSilo => (TYPES_SILO as readonly string[]).includes(t)))
      : undefined,
  }

  const supabase = getServiceClient()
  const brut = await getRapportSilo(supabase, dateDebut, dateFin)
  const lignes = filtrerLignesSilo(brut, filtres)
  const groupesMois = grouperParMois(lignes)
  const totaux = totauxParProduit(lignes)
  const totalGeneral = totaux.reduce((s, t) => s + t.total, 0)

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
    page.drawText('RAPPORT SILO', { x: PAGE_W - 220, y, font: fontBold, size: 14, color: brun })
    page.drawText(`Du ${fmtDate(dateDebut)} au ${fmtDate(dateFin)}`, { x: PAGE_W - 220, y: y - 18, font, size: 10, color: gray })
    y -= 60
    page.drawLine({ start: { x: 50, y }, end: { x: PAGE_W - 50, y }, thickness: 1.5, color: or })
    y -= 22
  }
  drawHeader()

  const filtresActifs = [
    filtres.produits && filtres.produits.length > 0 && `Céréale(s) : ${filtres.produits.join(', ')}`,
    filtres.fournisseurs && filtres.fournisseurs.length > 0 && `Fournisseur(s) : ${filtres.fournisseurs.join(', ')}`,
    filtres.typesSilo && filtres.typesSilo.length > 0 && `Type : ${filtres.typesSilo.join(', ')}`,
  ].filter(Boolean)
  if (filtresActifs.length) {
    ensureSpace(16)
    page.drawText(`Filtres actifs — ${filtresActifs.join(' · ')}`, { x: 50, y, font, size: 8, color: brun })
    y -= 20
  }

  function sectionTitle(title: string) {
    ensureSpace(30)
    y -= 4
    page.drawText(title, { x: 50, y, font: fontBold, size: 11, color: brun })
    y -= 8
    page.drawLine({ start: { x: 50, y }, end: { x: PAGE_W - 50, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
    y -= 16
  }

  // ── Totaux par céréale ───────────────────────────────────
  sectionTitle('TOTAL PAR CÉRÉALE')
  if (totaux.length === 0) {
    page.drawText('Aucun arrivage sur cette période.', { x: 50, y, font, size: 9, color: gray })
    y -= 16
  } else {
    for (const t of totaux) {
      ensureSpace(16)
      page.drawText(t.produit, { x: 54, y, font: fontBold, size: 9.5, color: black })
      page.drawText(fmtTonnes(t.total), { x: PAGE_W - 130, y, font: fontBold, size: 9.5, color: brun })
      y -= 15
    }
    ensureSpace(18)
    page.drawLine({ start: { x: 50, y: y + 6 }, end: { x: PAGE_W - 50, y: y + 6 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
    page.drawText('Total général', { x: 54, y, font: fontBold, size: 9.5, color: black })
    page.drawText(fmtTonnes(totalGeneral), { x: PAGE_W - 130, y, font: fontBold, size: 9.5, color: brun })
    y -= 24
  }

  // ── Détail des livraisons ────────────────────────────────
  const COLS = [
    { key: 'date', label: 'Date', x: 54, w: 66 },
    { key: 'produit', label: 'Produit', x: 126, w: 110 },
    { key: 'contrat', label: 'N° Contrat', x: 242, w: 110 },
    { key: 'fournisseur', label: 'Fournisseur', x: 358, w: 140 },
    { key: 'transporteur', label: 'Transporteur', x: 504, w: 110 },
    { key: 'silo', label: 'Silo', x: 620, w: 70 },
    { key: 'quantite', label: 'Quantité', x: 696, w: 70 },
  ]

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

  function tableHeader() {
    ensureSpace(20)
    COLS.forEach(c => page.drawText(c.label, { x: c.x, y, font: fontBold, size: 8.5, color: gray }))
    y -= 12
    page.drawLine({ start: { x: 50, y: y + 4 }, end: { x: PAGE_W - 50, y: y + 4 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    y -= 4
  }

  function tableRow(l: LigneRapportSilo) {
    const values: Record<string, string> = {
      date: sanitizeForPdf((l.dateApproximative ? '~ ' : '') + fmtLigneDate(l)),
      produit: sanitizeForPdf(l.produit),
      contrat: sanitizeForPdf(l.numeroContrat),
      fournisseur: sanitizeForPdf(l.fournisseur),
      transporteur: sanitizeForPdf(l.transporteur),
      silo: sanitizeForPdf(l.silo),
    }
    const linesByCol: Record<string, string[]> = {}
    let maxLines = 1
    COLS.forEach(c => {
      if (c.key === 'quantite') return
      const lines = wrapLines(values[c.key] ?? '—', c.w - 8)
      linesByCol[c.key] = lines
      maxLines = Math.max(maxLines, lines.length)
    })
    const rowHeight = maxLines * LINE_H + ROW_PAD
    ensureSpace(rowHeight)

    COLS.forEach(c => {
      if (c.key === 'quantite') return
      linesByCol[c.key].forEach((line, i) => {
        page.drawText(line, {
          x: c.x, y: y - i * LINE_H, font, size: 8.5,
          color: c.key === 'date' && l.dateApproximative ? or : black,
        })
      })
    })
    page.drawText(l.quantite != null ? fmtTonnes(l.quantite) : '—', {
      x: COLS[COLS.length - 1].x, y, font: fontBold, size: 8.5, color: brun,
    })
    y -= rowHeight
  }

  sectionTitle(`DÉTAIL DES LIVRAISONS PAR MOIS (${lignes.length})`)
  if (groupesMois.length === 0) {
    page.drawText('Aucune livraison sur cette période.', { x: 50, y, font, size: 9, color: gray })
    y -= 16
  } else {
    for (const g of groupesMois) {
      ensureSpace(40)
      page.drawText(g.label.toUpperCase(), { x: 50, y, font: fontBold, size: 9.5, color: black })
      page.drawText(`Total ${g.label.toLowerCase()} : ${fmtTonnes(g.total)}`, { x: PAGE_W - 220, y, font: fontBold, size: 9.5, color: brun })
      y -= 16
      tableHeader()
      for (const l of g.lignes) tableRow(l)
      y -= 10
    }
  }

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
      'Content-Disposition': `attachment; filename="rapport-silo-${dateDebut}_${dateFin}.pdf"`,
    },
  })
}
