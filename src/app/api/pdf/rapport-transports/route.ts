export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import {
  getRapportTransports, trierLignes, filtrerLignes, filtrerNonPlanifiees, NIVEAUX,
  type LigneRapport, type LigneNonPlanifiee, type TriChamp, type Ordre, type FiltresRapport,
} from '@/lib/rapport-transports'
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib'

const brun = rgb(0.482, 0.157, 0.125)
const or = rgb(0.784, 0.580, 0.102)
const gray = rgb(0.4, 0.4, 0.4)
const black = rgb(0, 0, 0)
const red = rgb(0.792, 0.149, 0.149)

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}
function niveauInfo(key: string) {
  return NIVEAUX.find(n => n.key === key) ?? NIVEAUX[0]
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
  return s.replace(/\u202f/g, '\u0020') + ' t'
}
function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}
function fmtLigneDate(l: LigneRapport) {
  return l.date ? fmtDate(l.date) : (l.periodeLabel || '—')
}

const TRI_VALIDES: TriChamp[] = ['date', 'agriculteur', 'contrat', 'fournisseur', 'statut']

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
  const filtres: FiltresRapport = {
    fournisseur: searchParams.get('fournisseur') || undefined,
    agriculteur: searchParams.get('agriculteur') || undefined,
    contrat: searchParams.get('contrat') || undefined,
    produit: searchParams.get('produit') || undefined,
    statut: (searchParams.get('statut') as FiltresRapport['statut']) || '',
  }

  const supabase = getServiceClient()
  const rapportBrut = await getRapportTransports(supabase, dateDebut, dateFin)
  const realisees = trierLignes(filtrerLignes(rapportBrut.realisees, filtres), tri, ordre)
  const planifiees = trierLignes(filtrerLignes(rapportBrut.planifiees, filtres), tri, ordre)
  const nonPlanifiees = filtrerNonPlanifiees(rapportBrut.nonPlanifiees, filtres)

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
    page.drawText('RAPPORT TRANSPORTS', { x: PAGE_W - 300, y, font: fontBold, size: 14, color: brun })
    page.drawText(`Du ${fmtDate(dateDebut)} au ${fmtDate(dateFin)}`, { x: PAGE_W - 300, y: y - 18, font, size: 10, color: gray })
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
    NIVEAUX.forEach(n => {
      const color = hexToRgb(n.hex)
      page.drawRectangle({ x, y: y - 1, width: 8, height: 8, color })
      page.drawText(n.label, { x: x + 12, y, font, size: 8, color: gray })
      x += 12 + font.widthOfTextAtSize(n.label, 8) + 16
    })
    y -= 20
    const filtresActifs = [
      filtres.fournisseur && `Fournisseur : ${filtres.fournisseur}`,
      filtres.agriculteur && `Agriculteur : ${filtres.agriculteur}`,
      filtres.contrat && `Contrat : ${filtres.contrat}`,
      filtres.produit && `Céréale : ${filtres.produit}`,
      filtres.statut && `Statut : ${niveauInfo(filtres.statut).label}`,
    ].filter(Boolean)
    if (filtresActifs.length) {
      ensureSpace(16)
      page.drawText(`Filtres actifs — ${filtresActifs.join(' · ')}`, { x: 50, y, font, size: 8, color: brun })
      y -= 16
    }
  }
  drawLegend()

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

  const COLS_LIVRAISON = [
    { key: 'date', label: 'Date', x: 54, w: 58 },
    { key: 'produit', label: 'Produit', x: 116, w: 64 },
    { key: 'contrat', label: 'N° Contrat', x: 184, w: 68 },
    { key: 'fournisseur', label: 'Fournisseur', x: 256, w: 68 },
    { key: 'origine', label: 'Origine', x: 328, w: 82 },
    { key: 'destination', label: 'Destination', x: 414, w: 72 },
    { key: 'agriculteur', label: 'Agriculteur', x: 490, w: 82 },
    { key: 'transporteur', label: 'Transporteur', x: 576, w: 58 },
    { key: 'quantite', label: 'Quantité', x: 638, w: 44 },
    { key: 'notes', label: 'Notes', x: 696, w: 96 },
  ]

  function tableHeaderLivraisons() {
    ensureSpace(20)
    COLS_LIVRAISON.forEach(c => page.drawText(c.label, { x: c.x, y, font: fontBold, size: 8.5, color: gray }))
    y -= 12
    page.drawLine({ start: { x: 50, y: y + 4 }, end: { x: PAGE_W - 50, y: y + 4 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    y -= 4
  }

  // Les champs libres (adresses de chargement, notes...) sont saisis à la main et
  // peuvent contenir des caractères que la police standard WinAnsi ne sait pas
  // encoder (retours à la ligne, espaces unicode...). On neutralise tout ce que la
  // police ne sait pas encoder plutôt que de traquer les caractères un par un.
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

  // Découpe un texte en au plus `maxLines` lignes tenant dans `maxWidth`, mesurée
  // avec la vraie police (un nombre fixe de caractères par point sous-estime la
  // largeur des textes en majuscules, très fréquents ici). Au-delà, ellipse.
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

  function tableRowLivraison(l: LigneRapport) {
    const statutColor = hexToRgb(niveauInfo(l.niveau).hex)
    const values: Record<string, string> = {
      // sanitizeForPdf s'applique après concaténation du préfixe : ça évite qu'un
      // caractère ajouté ici (comme le "≈" utilisé un temps, non encodable en
      // WinAnsi) ne fasse planter le rendu sans passer par le filtre.
      date: sanitizeForPdf((l.dateApproximative ? '~ ' : '') + fmtLigneDate(l)),
      produit: sanitizeForPdf(l.produit),
      contrat: sanitizeForPdf(l.numeroContrat),
      fournisseur: sanitizeForPdf(l.fournisseur),
      origine: sanitizeForPdf(l.origine),
      destination: sanitizeForPdf(l.destination),
      agriculteur: sanitizeForPdf(l.agriculteur),
      transporteur: sanitizeForPdf(l.transporteur),
      quantite: l.quantite != null ? fmtTonnes(l.quantite) : '—',
    }
    const linesByCol: Record<string, string[]> = {}
    let maxLines = 1
    COLS_LIVRAISON.forEach(c => {
      if (c.key === 'notes') return
      const lines = wrapLines(values[c.key] ?? '—', c.w - 8)
      linesByCol[c.key] = lines
      maxLines = Math.max(maxLines, lines.length)
    })
    const rowHeight = maxLines * LINE_H + ROW_PAD
    ensureSpace(rowHeight)

    // Bandeau couleur en début de ligne au lieu d'une colonne "Statut" en texte
    page.drawRectangle({ x: 44, y: y - rowHeight + ROW_PAD - 1, width: 4, height: rowHeight - 3, color: statutColor })
    // Séparateur avant la colonne Notes, vierge pour annotation manuscrite
    page.drawLine({
      start: { x: 690, y: y + 6 }, end: { x: 690, y: y - rowHeight + 6 },
      thickness: 0.4, color: rgb(0.85, 0.85, 0.85),
    })

    COLS_LIVRAISON.forEach(c => {
      if (c.key === 'notes') return
      const lines = linesByCol[c.key]
      lines.forEach((line, i) => {
        page.drawText(line, {
          x: c.x, y: y - i * LINE_H, font,
          size: 8.5,
          color: c.key === 'date' && l.dateApproximative ? or : black,
        })
      })
    })
    y -= rowHeight
  }

  function totalTonnage(rows: LigneRapport[]) {
    return rows.reduce((s, r) => s + (r.quantite ?? 0), 0)
  }

  // ── Réalisés ─────────────────────────────────────────────
  sectionTitle(
    `TRANSPORTS RÉALISÉS (${realisees.length})`,
    'Livraisons effectuées sur la période. Bandeau coloré = statut de suivi (voir légende). Colonne Notes vierge pour vos annotations.'
  )
  if (realisees.length === 0) {
    page.drawText('Aucun transport réalisé sur cette période.', { x: 50, y, font, size: 9, color: gray })
    y -= 16
  } else {
    tableHeaderLivraisons()
    for (const l of realisees) {
      tableRowLivraison(l)
    }
    ensureSpace(16)
    page.drawText(`Total réalisé : ${fmtTonnes(totalTonnage(realisees))}`, { x: 50, y, font: fontBold, size: 9, color: brun })
    y -= 20
  }

  // ── Planifiés / en attente ──────────────────────────────
  sectionTitle(
    `PLANIFIÉS — EN ATTENTE (${planifiees.length})`,
    'Transports prévus sur la période mais pas encore réalisés. Bandeau coloré = statut de suivi (voir légende). "~" = date approximative (mois seulement, à préciser).'
  )
  if (planifiees.length === 0) {
    page.drawText('Aucun transport planifié sur cette période.', { x: 50, y, font, size: 9, color: gray })
    y -= 16
  } else {
    tableHeaderLivraisons()
    for (const l of planifiees) {
      tableRowLivraison(l)
    }
    ensureSpace(16)
    page.drawText(`Total planifié : ${fmtTonnes(totalTonnage(planifiees))}`, { x: 50, y, font: fontBold, size: 9, color: brun })
    y -= 20
  }

  // ── Non planifiés ────────────────────────────────────────
  const COLS_ALERTE = [
    { key: 'contrat', label: 'N° Contrat', x: 50, w: 80 },
    { key: 'produit', label: 'Produit', x: 135, w: 75 },
    { key: 'fournisseur', label: 'Fournisseur', x: 215, w: 110 },
    { key: 'agriculteurs', label: 'Agriculteur(s)', x: 330, w: 160 },
    { key: 'transporteur', label: 'Transporteur habituel', x: 495, w: 100 },
    { key: 'dateFin', label: 'Fin contrat', x: 600, w: 75 },
    { key: 'reliquat', label: 'Reliquat', x: 680, w: 70 },
  ]

  sectionTitle(
    `NON PLANIFIÉS (${nonPlanifiees.length})`,
    'Contrats dont la date de fin tombe avant la fin de période, avec du reliquat, sans aucun transport programmé sur ces dates.'
  )
  if (nonPlanifiees.length === 0) {
    page.drawText('Aucun contrat en alerte sur cette période.', { x: 50, y, font, size: 9, color: gray })
    y -= 16
  } else {
    ensureSpace(20)
    COLS_ALERTE.forEach(c => page.drawText(c.label, { x: c.x, y, font: fontBold, size: 8.5, color: gray }))
    y -= 12
    page.drawLine({ start: { x: 50, y: y + 4 }, end: { x: PAGE_W - 50, y: y + 4 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    y -= 4
    for (const c of nonPlanifiees as LigneNonPlanifiee[]) {
      const values: Record<string, string> = {
        contrat: sanitizeForPdf(c.numeroContrat),
        produit: sanitizeForPdf(c.produit),
        fournisseur: sanitizeForPdf(c.fournisseur),
        agriculteurs: sanitizeForPdf(c.agriculteurs),
        transporteur: sanitizeForPdf(c.transporteur),
        dateFin: fmtDate(c.dateFinContrat),
        reliquat: fmtTonnes(c.quantiteRestante),
      }
      const linesByCol: Record<string, string[]> = {}
      let maxLines = 1
      COLS_ALERTE.forEach(col => {
        const lines = wrapLines(values[col.key] ?? '—', col.w - 8)
        linesByCol[col.key] = lines
        maxLines = Math.max(maxLines, lines.length)
      })
      const rowHeight = maxLines * LINE_H + ROW_PAD
      ensureSpace(rowHeight)
      COLS_ALERTE.forEach(col => {
        linesByCol[col.key].forEach((line, i) => {
          page.drawText(line, {
            x: col.x, y: y - i * LINE_H,
            font: col.key === 'reliquat' ? fontBold : font, size: 8.5,
            color: col.key === 'reliquat' ? red : black,
          })
        })
      })
      y -= rowHeight
    }
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
      'Content-Disposition': `attachment; filename="rapport-transports-${dateDebut}_${dateFin}.pdf"`,
    },
  })
}
