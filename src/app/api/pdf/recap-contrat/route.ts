export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib'

const brun = rgb(0.482, 0.157, 0.125)
const or   = rgb(0.784, 0.580, 0.102)
const gray = rgb(0.4, 0.4, 0.4)
const black = rgb(0, 0, 0)
const green = rgb(0.086, 0.639, 0.290)
const PAGE_W = 595
const PAGE_H = 842
const MARGIN_BOTTOM = 60

function fmtEuros(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
function fmtTonnes(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' t'
}
function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const contratId = searchParams.get('contrat_id')
  if (!contratId) return NextResponse.json({ error: 'Missing contrat_id' }, { status: 400 })

  const supabase = getServiceClient()
  const { data: contrat, error } = await supabase
    .from('contrats_achat')
    .select(`
      *,
      produit:produits(nom),
      fournisseur:fournisseurs(nom),
      courtier:courtiers(nom, numero_courtier),
      transporteur:transporteurs(nom),
      livraisons(id,type,quantite_prevue,quantite_reelle,date_reelle,contrat_vente_id,destination_silo,transporteur_id,numero_lettre_voiture,montant_transport_reel,transport_facture,numero_facture_transport,transporteur:transporteurs(nom)),
      contrats_vente(id,numero_contrat,quantite,agriculteur:agriculteurs(nom,civilite),factures_client(*)),
      factures_fournisseur(*)
    `)
    .eq('id', contratId)
    .single()

  if (error || !contrat) return NextResponse.json({ error: 'Contrat not found' }, { status: 404 })

  const livraisonsRealisees = (contrat.livraisons ?? []).filter((l: any) => l.type === 'realisee')
  const totalLivre = livraisonsRealisees.reduce((s: number, l: any) => s + (Number(l.quantite_reelle) || 0), 0)
  const qteTotale = Number(contrat.quantite_totale) || 0

  // Répartition par destination (agriculteur du contrat de vente lié, sinon silo)
  const parDestination = new Map<string, number>()
  for (const l of livraisonsRealisees) {
    const cv = (contrat.contrats_vente ?? []).find((v: any) => v.id === l.contrat_vente_id)
    const nom = cv?.agriculteur ? [cv.agriculteur.civilite, cv.agriculteur.nom].filter(Boolean).join(' ') : (l.destination_silo || 'Silo / non affecté')
    parDestination.set(nom, (parDestination.get(nom) || 0) + (Number(l.quantite_reelle) || 0))
  }

  // Répartition par transporteur
  const parTransporteur = new Map<string, { tonnes: number; montant: number; nbFactures: number; nbLivraisons: number }>()
  for (const l of livraisonsRealisees) {
    const nom = l.transporteur?.nom ?? contrat.transporteur?.nom ?? '—'
    const entry = parTransporteur.get(nom) || { tonnes: 0, montant: 0, nbFactures: 0, nbLivraisons: 0 }
    entry.tonnes += Number(l.quantite_reelle) || 0
    // montant_transport_reel est un prix par tonne : multiplier par le tonnage pour obtenir le coût réel
    entry.montant += (Number(l.montant_transport_reel) || 0) * (Number(l.quantite_reelle) || 0)
    entry.nbLivraisons += 1
    if (l.transport_facture) entry.nbFactures += 1
    parTransporteur.set(nom, entry)
  }

  const facturesFournisseur = contrat.factures_fournisseur ?? []
  const totalFournisseur = facturesFournisseur.reduce((s: number, f: any) => s + (Number(f.montant_ht) || 0), 0)

  const facturesClient: any[] = (contrat.contrats_vente ?? []).flatMap((cv: any) =>
    (cv.factures_client ?? []).map((f: any) => ({ ...f, destinataire: [cv.agriculteur?.civilite, cv.agriculteur?.nom].filter(Boolean).join(' ') || cv.numero_contrat }))
  )
  const totalClientHt = facturesClient.reduce((s: number, f: any) => s + (Number(f.montant_ht) || 0), 0)

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
    page.drawText('RÉCAPITULATIF DE CONTRAT', { x: PAGE_W - 260, y, font: fontBold, size: 14, color: brun })
    page.drawText(contrat.numero_contrat ?? '', { x: PAGE_W - 260, y: y - 18, font, size: 10, color: gray })
    y -= 60
    page.drawLine({ start: { x: 50, y }, end: { x: PAGE_W - 50, y }, thickness: 1.5, color: or })
    y -= 22
  }
  drawHeader()

  function sectionTitle(title: string) {
    ensureSpace(35)
    y -= 4
    page.drawText(title, { x: 50, y, font: fontBold, size: 11, color: brun })
    y -= 8
    page.drawLine({ start: { x: 50, y }, end: { x: PAGE_W - 50, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
    y -= 16
  }

  function row(label: string, value: string, bold = false) {
    ensureSpace(20)
    page.drawText(label, { x: 50, y, font, size: 10, color: gray })
    page.drawText(value || '—', { x: 240, y, font: bold ? fontBold : font, size: 10, color: black })
    y -= 18
  }

  function tableHeader(cols: { label: string; x: number }[]) {
    ensureSpace(20)
    cols.forEach(c => page.drawText(c.label, { x: c.x, y, font: fontBold, size: 9, color: gray }))
    y -= 12
    page.drawLine({ start: { x: 50, y: y + 4 }, end: { x: PAGE_W - 50, y: y + 4 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    y -= 4
  }

  function tableRow(cols: { text: string; x: number; bold?: boolean; color?: any }[]) {
    ensureSpace(16)
    cols.forEach(c => page.drawText(c.text, { x: c.x, y, font: c.bold ? fontBold : font, size: 9.5, color: c.color ?? black }))
    y -= 16
  }

  // ── Contrat ──────────────────────────────────────────────
  sectionTitle('CONTRAT')
  row('Produit', contrat.produit?.nom ?? '—', true)
  row('Fournisseur', contrat.fournisseur?.nom ?? '—')
  if (contrat.courtier) row('Courtier', `${contrat.courtier.nom}${contrat.courtier.numero_courtier ? ` (n° ${contrat.courtier.numero_courtier})` : ''}`)
  row('Statut', contrat.statut === 'clos' ? 'Clôturé' : 'En cours', true)
  row('Quantité contractuelle', fmtTonnes(qteTotale), true)
  row('Quantité livrée', `${fmtTonnes(totalLivre)}  (reliquat ${fmtTonnes(Math.max(0, qteTotale - totalLivre))})`, true)

  // ── Répartition par destination ─────────────────────────
  sectionTitle('TONNAGE LIVRÉ PAR DESTINATION')
  if (parDestination.size === 0) {
    page.drawText('Aucune livraison réalisée.', { x: 50, y, font, size: 9.5, color: gray })
    y -= 16
  } else {
    tableHeader([{ label: 'Destination', x: 50 }, { label: 'Quantité', x: 400 }])
    for (const [nom, tonnes] of parDestination) {
      tableRow([{ text: nom, x: 50 }, { text: fmtTonnes(tonnes), x: 400 }])
    }
  }

  // ── Transports ───────────────────────────────────────────
  sectionTitle('TRANSPORTS')
  if (parTransporteur.size === 0) {
    page.drawText('Aucun transport enregistré.', { x: 50, y, font, size: 9.5, color: gray })
    y -= 16
  } else {
    tableHeader([{ label: 'Transporteur', x: 50 }, { label: 'Livraisons', x: 260 }, { label: 'Quantité', x: 340 }, { label: 'Montant facturé', x: 430 }])
    let totalMontantTransport = 0
    for (const [nom, v] of parTransporteur) {
      totalMontantTransport += v.montant
      tableRow([
        { text: nom, x: 50 },
        { text: `${v.nbLivraisons} (${v.nbFactures} facturée${v.nbFactures > 1 ? 's' : ''})`, x: 260 },
        { text: fmtTonnes(v.tonnes), x: 340 },
        { text: fmtEuros(v.montant), x: 430 },
      ])
    }
    ensureSpace(18)
    y -= 2
    page.drawLine({ start: { x: 50, y: y + 12 }, end: { x: PAGE_W - 50, y: y + 12 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    tableRow([{ text: 'TOTAL', x: 50, bold: true, color: brun }, { text: '', x: 260 }, { text: '', x: 340 }, { text: fmtEuros(totalMontantTransport), x: 430, bold: true, color: brun }])
  }

  // ── Factures fournisseur ────────────────────────────────
  sectionTitle('FACTURES FOURNISSEUR')
  if (facturesFournisseur.length === 0) {
    page.drawText('Aucune facture fournisseur.', { x: 50, y, font, size: 9.5, color: gray })
    y -= 16
  } else {
    tableHeader([{ label: 'N° Facture', x: 50 }, { label: 'Date', x: 220 }, { label: 'Montant HT', x: 320 }])
    for (const f of facturesFournisseur) {
      tableRow([{ text: f.numero_facture ?? '—', x: 50 }, { text: fmtDate(f.date_facture), x: 220 }, { text: fmtEuros(Number(f.montant_ht) || 0), x: 320 }])
    }
    ensureSpace(18)
    page.drawLine({ start: { x: 50, y: y + 12 }, end: { x: PAGE_W - 50, y: y + 12 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    tableRow([{ text: 'TOTAL', x: 50, bold: true, color: brun }, { text: '', x: 220 }, { text: fmtEuros(totalFournisseur), x: 320, bold: true, color: brun }])
  }

  // ── Factures client ──────────────────────────────────────
  sectionTitle('FACTURES CLIENT')
  if (facturesClient.length === 0) {
    page.drawText('Aucune facture client.', { x: 50, y, font, size: 9.5, color: gray })
    y -= 16
  } else {
    tableHeader([{ label: 'Destinataire', x: 50 }, { label: 'N° Facture', x: 220 }, { label: 'Montant HT', x: 400 }])
    for (const f of facturesClient) {
      tableRow([{ text: f.destinataire ?? '—', x: 50 }, { text: f.numero_facture_logiciel ?? f.numero_facture ?? '—', x: 220 }, { text: fmtEuros(Number(f.montant_ht) || 0), x: 400 }])
    }
    ensureSpace(18)
    page.drawLine({ start: { x: 50, y: y + 12 }, end: { x: PAGE_W - 50, y: y + 12 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    tableRow([{ text: 'TOTAL', x: 50, bold: true, color: brun }, { text: '', x: 220 }, { text: fmtEuros(totalClientHt), x: 400, bold: true, color: brun }])
  }

  // ── Marge ────────────────────────────────────────────────
  if (facturesClient.length > 0 && facturesFournisseur.length > 0) {
    sectionTitle('MARGE')
    const marge = totalClientHt - totalFournisseur
    row('CA client (HT)', fmtEuros(totalClientHt))
    row('Coût fournisseur (HT)', fmtEuros(totalFournisseur))
    row('Marge brute', fmtEuros(marge), true)
  }

  // Pied de page sur chaque page
  const pages = pdfDoc.getPages()
  pages.forEach((p, i) => {
    p.drawText(`Édité le ${new Date().toLocaleDateString('fr-FR')} — page ${i + 1}/${pages.length}`, {
      x: 50, y: 30, font, size: 8, color: gray,
    })
  })

  const pdfBytes = await pdfDoc.save()

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recap-${contrat.numero_contrat ?? contratId}.pdf"`,
    },
  })
}
