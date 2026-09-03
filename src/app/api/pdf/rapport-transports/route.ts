export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { getRapportTransports, type LigneRapport, type LigneNonPlanifiee } from '@/lib/rapport-transports'
import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib'

const brun = rgb(0.482, 0.157, 0.125)
const or = rgb(0.784, 0.580, 0.102)
const gray = rgb(0.4, 0.4, 0.4)
const black = rgb(0, 0, 0)
const green = rgb(0.086, 0.639, 0.290)
const red = rgb(0.792, 0.149, 0.149)
const PAGE_W = 842
const PAGE_H = 595
const MARGIN_BOTTOM = 55

function fmtTonnes(n: number | null | undefined) {
  // Helvetica (WinAnsi) ne sait pas encoder l'espace fine insécable (U+202F)
  // que toLocaleString('fr-FR') utilise comme séparateur de milliers.
  return (n ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, ' ') + ' t'
}
function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}
function fmtLigneDate(l: LigneRapport) {
  return l.date ? fmtDate(l.date) : (l.periodeLabel || '—')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateDebut = searchParams.get('date_debut')
  const dateFin = searchParams.get('date_fin')
  if (!dateDebut || !dateFin) {
    return NextResponse.json({ error: 'date_debut et date_fin sont requis' }, { status: 400 })
  }

  const supabase = getServiceClient()
  const { realisees, planifiees, nonPlanifiees } = await getRapportTransports(supabase, dateDebut, dateFin)

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
    { key: 'date', label: 'Date', x: 50, w: 68 },
    { key: 'produit', label: 'Produit', x: 118, w: 72 },
    { key: 'contrat', label: 'N° Contrat', x: 190, w: 80 },
    { key: 'fournisseur', label: 'Fournisseur', x: 270, w: 92 },
    { key: 'origine', label: 'Origine', x: 362, w: 80 },
    { key: 'destination', label: 'Destination', x: 442, w: 80 },
    { key: 'agriculteur', label: 'Agriculteur', x: 522, w: 100 },
    { key: 'transporteur', label: 'Transporteur', x: 622, w: 90 },
    { key: 'quantite', label: 'Quantité', x: 712, w: 55 },
    { key: 'statut', label: 'Statut', x: 767, w: 60 },
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

  // Tronque en mesurant la largeur réelle du texte avec la police (un nombre fixe
  // de caractères par point sous-estime la largeur des textes en majuscules, très
  // fréquents ici : fournisseurs, villes, agriculteurs).
  function truncate(s: string, w: number, size = 8.5) {
    const maxWidth = w - 8 // marge pour ne jamais coller à la colonne suivante
    if (font.widthOfTextAtSize(s, size) <= maxWidth) return s
    let lo = 0
    let hi = s.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      const candidate = s.slice(0, mid) + '…'
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) lo = mid
      else hi = mid - 1
    }
    return s.slice(0, lo) + '…'
  }

  function tableRowLivraison(l: LigneRapport, statutText: string, statutColor: any) {
    ensureSpace(16)
    const values: Record<string, string> = {
      date: sanitizeForPdf(fmtLigneDate(l)),
      produit: sanitizeForPdf(l.produit),
      contrat: sanitizeForPdf(l.numeroContrat),
      fournisseur: sanitizeForPdf(l.fournisseur),
      origine: sanitizeForPdf(l.origine),
      destination: sanitizeForPdf(l.destination),
      agriculteur: sanitizeForPdf(l.agriculteur),
      transporteur: sanitizeForPdf(l.transporteur),
      quantite: l.quantite != null ? fmtTonnes(l.quantite) : '—',
    }
    COLS_LIVRAISON.forEach(c => {
      if (c.key === 'statut') {
        page.drawText(statutText, { x: c.x, y, font: fontBold, size: 8, color: statutColor })
      } else {
        page.drawText(truncate(values[c.key] ?? '—', c.w), { x: c.x, y, font, size: 8.5, color: black })
      }
    })
    y -= 15
  }

  function totalTonnage(rows: LigneRapport[]) {
    return rows.reduce((s, r) => s + (r.quantite ?? 0), 0)
  }

  // ── Réalisés ─────────────────────────────────────────────
  sectionTitle(
    `TRANSPORTS RÉALISÉS (${realisees.length})`,
    'Livraisons effectuées sur la période. "CMR manquant" signale un document (CMR ou BA) encore à récupérer.'
  )
  if (realisees.length === 0) {
    page.drawText('Aucun transport réalisé sur cette période.', { x: 50, y, font, size: 9, color: gray })
    y -= 16
  } else {
    tableHeaderLivraisons()
    for (const l of realisees) {
      tableRowLivraison(l, l.cmrManquant ? 'CMR manquant' : 'Complet', l.cmrManquant ? red : green)
    }
    ensureSpace(16)
    page.drawText(`Total réalisé : ${fmtTonnes(totalTonnage(realisees))}`, { x: 50, y, font: fontBold, size: 9, color: brun })
    y -= 20
  }

  // ── Planifiés / en attente ──────────────────────────────
  sectionTitle(
    `PLANIFIÉS — EN ATTENTE (${planifiees.length})`,
    'Transports prévus sur la période mais pas encore réalisés. "Confirmé" = transporteur déjà contacté.'
  )
  if (planifiees.length === 0) {
    page.drawText('Aucun transport planifié sur cette période.', { x: 50, y, font, size: 9, color: gray })
    y -= 16
  } else {
    tableHeaderLivraisons()
    for (const l of planifiees) {
      tableRowLivraison(l, l.transporteurConfirme ? 'Confirmé' : 'À confirmer', l.transporteurConfirme ? green : or)
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
      ensureSpace(16)
      const values: Record<string, string> = {
        contrat: sanitizeForPdf(c.numeroContrat),
        produit: sanitizeForPdf(c.produit),
        fournisseur: sanitizeForPdf(c.fournisseur),
        agriculteurs: sanitizeForPdf(c.agriculteurs),
        transporteur: sanitizeForPdf(c.transporteur),
        dateFin: fmtDate(c.dateFinContrat),
        reliquat: fmtTonnes(c.quantiteRestante),
      }
      COLS_ALERTE.forEach(col => {
        page.drawText(truncate(values[col.key] ?? '—', col.w), {
          x: col.x, y, font: col.key === 'reliquat' ? fontBold : font, size: 8.5, color: col.key === 'reliquat' ? red : black,
        })
      })
      y -= 15
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
