export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { getPrefixes } from '@/lib/prefixes'
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib'

const brun = rgb(0.482, 0.157, 0.125)
const or   = rgb(0.784, 0.580, 0.102)
const gray = rgb(0.4, 0.4, 0.4)
const black = rgb(0, 0, 0)
const red = rgb(0.792, 0.149, 0.149)
// Format paysage : beaucoup plus de colonnes à faire tenir (pièces BA/LC/EA/LA,
// transport, facturation...) qu'un simple récap une-colonne ne peut contenir.
const PAGE_W = 842
const PAGE_H = 595
const MARGIN_BOTTOM = 55
const LINE_H = 10
const ROW_PAD = 6

// Helvetica (WinAnsi) ne sait pas encoder l'espace fine insecable (U+202F)
// que toLocaleString('fr-FR') utilise comme separateur de milliers.
function sansEspaceFine(s: string) {
  return s.replace(/ /g, ' ')
}
function fmtEuros(n: number | null | undefined) {
  if (n == null) return '—'
  return sansEspaceFine(n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' €'
}
function fmtEurosT(n: number | null | undefined) {
  if (n == null) return '—'
  return sansEspaceFine(n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' €/t'
}
function fmtTonnes(n: number | null | undefined) {
  if (n == null) return '—'
  return sansEspaceFine(n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' t'
}
function fmtDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}
function piece(prefixe: string | null | undefined, numero: string | null | undefined) {
  return prefixe && numero ? `${prefixe} ${numero}` : '—'
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
      livraisons(*, transporteur:transporteurs(nom)),
      contrats_vente(*, produit:produits(nom), agriculteur:agriculteurs(nom,civilite), factures_client(*)),
      factures_fournisseur(*)
    `)
    .eq('id', contratId)
    .single()

  if (error || !contrat) return NextResponse.json({ error: 'Contrat not found' }, { status: 404 })

  const prefixes = getPrefixes(contrat.famille)
  const contratsVente: any[] = contrat.contrats_vente ?? []

  function getCv(l: any) {
    return contratsVente.find((v: any) => v.id === l.contrat_vente_id)
  }
  function destinataireLivraison(l: any) {
    if (l.solde_ouverture) return 'Solde d\'ouverture (migration)'
    const cv = getCv(l)
    if (!cv) return l.destination_silo ? 'Silo / non affecté' : '—'
    if (cv.destination_silo) return `🏚 ${cv.silo_nom ?? 'Silo'}`
    return [cv.agriculteur?.civilite, cv.agriculteur?.nom].filter(Boolean).join(' ') || '—'
  }

  const livraisonsRealisees = (contrat.livraisons ?? [])
    .filter((l: any) => l.type === 'realisee')
    .sort((a: any, b: any) => (a.date_reelle ?? '').localeCompare(b.date_reelle ?? ''))
  const livraisonsPlanifiees = (contrat.livraisons ?? [])
    .filter((l: any) => l.type === 'planifiee')
    .sort((a: any, b: any) => (a.mois_prevu ?? '').localeCompare(b.mois_prevu ?? ''))

  const totalLivre = livraisonsRealisees.reduce((s: number, l: any) => s + (Number(l.quantite_reelle) || 0), 0)
  const qteTotale = Number(contrat.quantite_totale) || 0
  const totalVentes = contratsVente.reduce((s: number, cv: any) => s + (Number(cv.quantite) || 0), 0)

  // Statut d'avancement d'une livraison planifiée — mêmes paliers que le suivi
  // "À organiser" du reste de l'appli (agriculteur contacté → PDF envoyé au
  // transporteur → transport confirmé), en texte simple pour ce tableau dense.
  function statutPlanifiee(l: any): string {
    if (l.transporteur_contacte) return 'Transport confirmé'
    if (l.pdf_envoye) return 'Exécution demandée'
    if (l.agriculteur_contacte || l.date_souhaitee || l.semaine_souhaitee) return 'Agri contacté'
    return 'Non démarré'
  }
  function periodePlanifiee(l: any): string {
    if (l.date_prevue) return fmtDate(l.date_prevue)
    if (l.semaine_prevue) return `Sem. ${l.semaine_prevue}`
    return l.mois_prevu ? new Date(l.mois_prevu).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '—'
  }

  // Répartition du transport par transporteur (montant_transport_reel est un
  // prix par tonne : on le multiplie par le tonnage pour obtenir le coût réel)
  const parTransporteur = new Map<string, { tonnes: number; montant: number; nbFactures: number; nbLivraisons: number }>()
  for (const l of livraisonsRealisees) {
    const nom = l.transporteur?.nom ?? contrat.transporteur?.nom ?? '—'
    const entry = parTransporteur.get(nom) || { tonnes: 0, montant: 0, nbFactures: 0, nbLivraisons: 0 }
    entry.tonnes += Number(l.quantite_reelle) || 0
    entry.montant += (Number(l.montant_transport_reel) || 0) * (Number(l.quantite_reelle) || 0)
    entry.nbLivraisons += 1
    if (l.transport_facture) entry.nbFactures += 1
    parTransporteur.set(nom, entry)
  }

  const facturesFournisseur = contrat.factures_fournisseur ?? []
  const totalFournisseurHt = facturesFournisseur.reduce((s: number, f: any) => s + (Number(f.montant_ht) || 0), 0)
  const facturesClient: any[] = contratsVente.flatMap((cv: any) =>
    (cv.factures_client ?? []).map((f: any) => ({ ...f, destinataire: cv.destination_silo ? `🏚 ${cv.silo_nom ?? 'Silo'}` : ([cv.agriculteur?.civilite, cv.agriculteur?.nom].filter(Boolean).join(' ') || cv.numero_contrat) }))
  )
  const totalClientHt = facturesClient.reduce((s: number, f: any) => s + (Number(f.montant_ht) || 0), 0)
  const coutTransportReel = livraisonsRealisees.reduce((s: number, l: any) => s + (Number(l.montant_transport_reel) || 0) * (Number(l.quantite_reelle) || 0), 0)

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

  // Une ligne = 2 paires label/valeur, pour profiter de la largeur en paysage.
  // Les valeurs passent par sanitizeForPdf (saisie libre, symboles non encodables
  // en WinAnsi) et par wrapLines : une adresse ou une référence fournisseur trop
  // longue déborderait sinon dans la marge, voire hors de la page.
  function rowPair(a: [string, string | null | undefined], b?: [string, string | null | undefined]) {
    const linesA = wrapLines(sanitizeForPdf(a[1] || '—', 9.5), 230, 9.5, 2)
    const linesB = b ? wrapLines(sanitizeForPdf(b[1] || '—', 9.5), 212, 9.5, 2) : []
    const rowHeight = Math.max(linesA.length, linesB.length, 1) * 12 + 3
    ensureSpace(rowHeight)
    page.drawText(a[0], { x: 50, y, font, size: 9.5, color: gray })
    linesA.forEach((line, i) => page.drawText(line, { x: 190, y: y - i * 12, font: fontBold, size: 9.5, color: black }))
    if (b) {
      page.drawText(b[0], { x: 430, y, font, size: 9.5, color: gray })
      linesB.forEach((line, i) => page.drawText(line, { x: 570, y: y - i * 12, font: fontBold, size: 9.5, color: black }))
    }
    y -= rowHeight
  }
  function rowFull(label: string, value: string) {
    const lines = wrapLines(sanitizeForPdf(value, 9.5), 590, 9.5, 3)
    const rowHeight = lines.length * 12 + 3
    ensureSpace(rowHeight)
    page.drawText(label, { x: 50, y, font, size: 9.5, color: gray })
    lines.forEach((line, i) => page.drawText(line, { x: 190, y: y - i * 12, font, size: 9.5, color: black }))
    y -= rowHeight
  }

  // Les champs libres (notes, adresses saisies à la main) peuvent contenir des
  // caractères que la police standard WinAnsi ne sait pas encoder — on les
  // neutralise plutôt que de planter le rendu.
  function sanitizeForPdf(s: string, size = 8.5): string {
    const cleaned = (s ?? '').replace(/[\r\n\t]+/g, ' ')
    try {
      font.widthOfTextAtSize(cleaned, size)
      return cleaned
    } catch {
      let result = ''
      for (const ch of cleaned) {
        try { font.widthOfTextAtSize(ch, size); result += ch } catch { result += ' ' }
      }
      return result.replace(/\s+/g, ' ').trim()
    }
  }

  function wrapLines(rawText: string, maxWidth: number, size = 8, maxLines = 2): string[] {
    const text = (rawText || '').trim()
    if (!text) return ['']
    const words = text.split(/\s+/)
    const allLines: string[] = []
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { current = candidate; continue }
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
    while (last.length > 0 && font.widthOfTextAtSize(last + '…', size) > maxWidth) last = last.slice(0, -1)
    shown[maxLines - 1] = last + '…'
    return shown
  }

  type Col = { key: string; label: string; x: number; w: number }
  function tableHeader(cols: Col[]) {
    ensureSpace(20)
    cols.forEach(c => page.drawText(c.label, { x: c.x, y, font: fontBold, size: 8, color: gray }))
    y -= 11
    page.drawLine({ start: { x: 50, y: y + 4 }, end: { x: PAGE_W - 50, y: y + 4 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    y -= 4
  }
  function tableRowWrapped(cols: Col[], values: Record<string, string>) {
    const linesByCol: Record<string, string[]> = {}
    let maxLines = 1
    cols.forEach(c => {
      const lines = wrapLines(sanitizeForPdf(values[c.key] ?? '—'), c.w - 6)
      linesByCol[c.key] = lines
      maxLines = Math.max(maxLines, lines.length)
    })
    const rowHeight = maxLines * LINE_H + ROW_PAD
    ensureSpace(rowHeight)
    cols.forEach(c => {
      linesByCol[c.key].forEach((line, i) => {
        page.drawText(line, { x: c.x, y: y - i * LINE_H, font, size: 8, color: black })
      })
    })
    y -= rowHeight
  }
  function tableRowSimple(cols: { text: string; x: number; bold?: boolean; color?: any }[]) {
    ensureSpace(16)
    cols.forEach(c => page.drawText(c.text, { x: c.x, y, font: c.bold ? fontBold : font, size: 9, color: c.color ?? black }))
    y -= 16
  }

  // ── Contrat ──────────────────────────────────────────────
  sectionTitle('CONTRAT')
  rowPair(['Produit', contrat.produit?.nom], ['Famille', contrat.famille === 'negoce' ? 'Négoce' : 'Appro'])
  rowPair(['Fournisseur', contrat.fournisseur?.nom], ['Référence fournisseur', contrat.reference_fournisseur])
  rowPair(
    ['Courtier', contrat.courtier ? `${contrat.courtier.nom}${contrat.courtier.numero_courtier ? ` (n° ${contrat.courtier.numero_courtier})` : ''}` : null],
    ['Transporteur habituel', contrat.transporteur?.nom]
  )
  rowPair(['Prix achat', contrat.prix_achat != null ? fmtEurosT(Number(contrat.prix_achat)) : null], ['Prix transport prévu', contrat.prix_transport_prevu != null ? fmtEurosT(Number(contrat.prix_transport_prevu)) : null])
  rowPair(['Point de chargement', contrat.point_chargement], ['Ville de chargement', contrat.ville_chargement])
  rowPair(['Date début', fmtDate(contrat.date_debut)], ['Date fin', fmtDate(contrat.date_fin)])
  rowPair(['Date conclusion', contrat.date_conclusion ? fmtDate(contrat.date_conclusion) : null], ['Statut', contrat.statut === 'clos' ? 'Clôturé' : 'En cours'])
  if (contrat.famille === 'negoce') {
    rowPair(
      ['Base prix', contrat.base_prix ? String(contrat.base_prix).replace('juillet_', 'Base Juillet ') : null],
      ['MBM autorisées', contrat.mbm_autorise ? 'Oui' : 'Non']
    )
  }
  rowPair(['Contact enlèvement', contrat.contact_enlevement], ['Géré par silo', contrat.gere_par_silo ? 'Oui' : 'Non'])
  if (contrat.adresses_chargement_sup?.length) {
    rowFull('Adresses de chargement sup.', sanitizeForPdf(contrat.adresses_chargement_sup.join(', '), 9.5))
  }
  if (contrat.note_alerte) rowFull('Note d\'alerte', sanitizeForPdf(contrat.note_alerte, 9.5))
  if (contrat.notes) rowFull('Notes', sanitizeForPdf(contrat.notes, 9.5))
  y -= 4
  rowPair(['Quantité contractuelle', fmtTonnes(qteTotale)], ['Quantité livrée', fmtTonnes(totalLivre)])
  rowPair(
    ['Reliquat à livrer', fmtTonnes(Math.max(0, qteTotale - totalLivre))],
    ['Total vendu (contrats de vente)', totalVentes > qteTotale ? `${fmtTonnes(totalVentes)}  (dépassement)` : fmtTonnes(totalVentes)]
  )

  // ── Répartition — contrats de vente ─────────────────────
  sectionTitle('RÉPARTITION — CONTRATS DE VENTE')
  if (contratsVente.length === 0) {
    page.drawText('Aucun contrat de vente lié.', { x: 50, y, font, size: 9, color: gray })
    y -= 16
  } else {
    const COLS_VENTE: Col[] = [
      { key: 'contrat', label: 'N° Contrat', x: 50, w: 85 },
      { key: 'destinataire', label: 'Agriculteur / Silo', x: 140, w: 150 },
      { key: 'produit', label: 'Produit', x: 295, w: 90 },
      { key: 'quantite', label: 'Quantité', x: 390, w: 55 },
      { key: 'prix', label: 'Prix vente', x: 450, w: 70 },
      { key: 'debut', label: 'Début', x: 525, w: 60 },
      { key: 'fin', label: 'Fin', x: 590, w: 60 },
      { key: 'statut', label: 'Statut', x: 655, w: 80 },
    ]
    tableHeader(COLS_VENTE)
    for (const cv of contratsVente) {
      const destinataire = cv.destination_silo ? `🏚 ${cv.silo_nom ?? 'Silo'}` : (cv.agriculteur?.nom ?? '—')
      tableRowWrapped(COLS_VENTE, {
        contrat: cv.numero_contrat ?? 'Sans n°',
        destinataire,
        produit: cv.produit?.nom ?? '—',
        quantite: fmtTonnes(Number(cv.quantite) || 0),
        prix: cv.prix_vente != null ? fmtEurosT(Number(cv.prix_vente)) : '—',
        debut: fmtDate(cv.date_debut),
        fin: fmtDate(cv.date_fin),
        statut: cv.destination_silo ? 'Silo' : (cv.statut === 'clos' ? 'Clôturé' : 'En cours'),
      })
    }
    ensureSpace(16)
    page.drawLine({ start: { x: 50, y: y + 12 }, end: { x: PAGE_W - 50, y: y + 12 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    tableRowSimple([{ text: 'TOTAL', x: 50, bold: true, color: brun }, { text: fmtTonnes(totalVentes), x: 390, bold: true, color: brun }])
  }

  // ── Livraisons réalisées ─────────────────────────────────
  sectionTitle(`LIVRAISONS RÉALISÉES (${livraisonsRealisees.length})`)
  if (livraisonsRealisees.length === 0) {
    page.drawText('Aucune livraison réalisée.', { x: 50, y, font, size: 9, color: gray })
    y -= 16
  } else {
    const COLS_REAL: Col[] = [
      { key: 'date', label: 'Date', x: 50, w: 58 },
      { key: 'destinataire', label: 'Destinataire', x: 108, w: 80 },
      { key: 'villeEnl', label: 'Ville enl.', x: 188, w: 55 },
      { key: 'villeDest', label: 'Ville dest.', x: 243, w: 55 },
      { key: 'transporteur', label: 'Transporteur', x: 298, w: 65 },
      { key: 'quantite', label: 'Qté', x: 363, w: 40 },
      { key: 'cmr', label: 'CMR', x: 403, w: 50 },
      { key: 'pieceFourn', label: prefixes.fournisseur, x: 453, w: 58 },
      { key: 'pieceClient', label: prefixes.client, x: 511, w: 58 },
      { key: 'mad', label: 'N° MAD', x: 569, w: 44 },
      { key: 'transpPrevu', label: 'Tr. prévu', x: 613, w: 48 },
      { key: 'transpReel', label: 'Tr. réel', x: 661, w: 48 },
      { key: 'ecart', label: 'Écart', x: 709, w: 42 },
      { key: 'facture', label: 'Facturé', x: 751, w: 40 },
    ]
    tableHeader(COLS_REAL)
    for (const l of livraisonsRealisees) {
      const prevu = contrat.prix_transport_prevu != null ? Number(contrat.prix_transport_prevu) : null
      const reel = l.montant_transport_reel != null ? Number(l.montant_transport_reel) : null
      const ecart = prevu != null && reel != null ? reel - prevu : null
      tableRowWrapped(COLS_REAL, {
        date: fmtDate(l.date_reelle),
        destinataire: destinataireLivraison(l),
        villeEnl: l.ville_chargement ?? contrat.ville_chargement ?? '—',
        villeDest: l.ville_destination ?? '—',
        transporteur: l.transporteur?.nom ?? contrat.transporteur?.nom ?? '—',
        quantite: fmtTonnes(Number(l.quantite_reelle) || 0),
        cmr: l.numero_lettre_voiture ?? '—',
        pieceFourn: piece(l.piece_fournisseur_prefixe, l.piece_fournisseur_numero),
        pieceClient: piece(l.piece_client_prefixe, l.piece_client_numero),
        mad: l.numero_mise_a_disposition ?? '—',
        transpPrevu: prevu != null ? fmtEurosT(prevu) : '—',
        transpReel: reel != null ? fmtEurosT(reel) : '—',
        ecart: ecart != null ? `${ecart >= 0 ? '+' : ''}${ecart.toFixed(2)} €/t` : '—',
        facture: l.transport_facture ? 'Oui' : 'Non',
      })
    }
    ensureSpace(16)
    page.drawLine({ start: { x: 50, y: y + 12 }, end: { x: PAGE_W - 50, y: y + 12 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    tableRowSimple([{ text: 'TOTAL', x: 50, bold: true, color: brun }, { text: fmtTonnes(totalLivre), x: 378, bold: true, color: brun }])
  }

  // ── Livraisons planifiées (non réalisées) ────────────────
  sectionTitle(`LIVRAISONS PLANIFIÉES — NON RÉALISÉES (${livraisonsPlanifiees.length})`)
  if (livraisonsPlanifiees.length === 0) {
    page.drawText('Aucune livraison planifiée en attente.', { x: 50, y, font, size: 9, color: gray })
    y -= 16
  } else {
    const COLS_PLAN: Col[] = [
      { key: 'periode', label: 'Période', x: 50, w: 65 },
      { key: 'destinataire', label: 'Client / Destination', x: 120, w: 120 },
      { key: 'quantite', label: 'Tonnes', x: 245, w: 55 },
      { key: 'villeEnl', label: 'Ville enlèv.', x: 305, w: 80 },
      { key: 'villeDest', label: 'Ville dest.', x: 390, w: 80 },
      { key: 'transporteur', label: 'Transporteur', x: 475, w: 80 },
      { key: 'pieceFourn', label: prefixes.fournisseur, x: 560, w: 60 },
      { key: 'pieceClient', label: prefixes.client, x: 625, w: 60 },
      { key: 'statut', label: 'Avancement', x: 690, w: 100 },
    ]
    tableHeader(COLS_PLAN)
    for (const l of livraisonsPlanifiees) {
      tableRowWrapped(COLS_PLAN, {
        periode: periodePlanifiee(l),
        destinataire: destinataireLivraison(l),
        quantite: fmtTonnes(Number(l.quantite_prevue) || 0),
        villeEnl: l.ville_chargement ?? contrat.ville_chargement ?? '—',
        villeDest: l.ville_destination ?? '—',
        transporteur: l.transporteur?.nom ?? contrat.transporteur?.nom ?? '—',
        pieceFourn: piece(l.piece_fournisseur_prefixe, l.piece_fournisseur_numero),
        pieceClient: piece(l.piece_client_prefixe, l.piece_client_numero),
        statut: statutPlanifiee(l),
      })
    }
    ensureSpace(16)
    const totalPrevu = livraisonsPlanifiees.reduce((s: number, l: any) => s + (Number(l.quantite_prevue) || 0), 0)
    page.drawLine({ start: { x: 50, y: y + 12 }, end: { x: PAGE_W - 50, y: y + 12 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    tableRowSimple([{ text: 'TOTAL', x: 50, bold: true, color: brun }, { text: fmtTonnes(totalPrevu), x: 245, bold: true, color: brun }])
  }

  // ── Transports — synthèse par transporteur ──────────────
  sectionTitle('TRANSPORTS — SYNTHÈSE PAR TRANSPORTEUR')
  if (parTransporteur.size === 0) {
    page.drawText('Aucun transport enregistré.', { x: 50, y, font, size: 9, color: gray })
    y -= 16
  } else {
    const COLS_TP: Col[] = [
      { key: 'nom', label: 'Transporteur', x: 50, w: 200 },
      { key: 'livraisons', label: 'Livraisons', x: 260, w: 150 },
      { key: 'tonnes', label: 'Quantité', x: 420, w: 80 },
      { key: 'montant', label: 'Montant facturé', x: 510, w: 100 },
    ]
    tableHeader(COLS_TP)
    let totalMontantTransport = 0
    for (const [nom, v] of parTransporteur) {
      totalMontantTransport += v.montant
      tableRowWrapped(COLS_TP, {
        nom,
        livraisons: `${v.nbLivraisons} (${v.nbFactures} facturée${v.nbFactures > 1 ? 's' : ''})`,
        tonnes: fmtTonnes(v.tonnes),
        montant: fmtEuros(v.montant),
      })
    }
    ensureSpace(16)
    page.drawLine({ start: { x: 50, y: y + 12 }, end: { x: PAGE_W - 50, y: y + 12 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    tableRowSimple([{ text: 'TOTAL', x: 50, bold: true, color: brun }, { text: fmtEuros(totalMontantTransport), x: 510, bold: true, color: brun }])
  }

  // ── Factures fournisseur ─────────────────────────────────
  sectionTitle(`FACTURES FOURNISSEUR (${facturesFournisseur.length})`)
  if (facturesFournisseur.length === 0) {
    page.drawText(
      livraisonsRealisees.length > 0 ? 'Des livraisons réalisées n\'ont pas encore de facture fournisseur.' : 'Aucune facture fournisseur.',
      { x: 50, y, font, size: 9, color: livraisonsRealisees.length > 0 ? red : gray }
    )
    y -= 16
  } else {
    const COLS_FF: Col[] = [
      { key: 'numFacture', label: 'N° Facture', x: 50, w: 78 },
      { key: 'piece', label: 'N° Pièce Atys', x: 133, w: 72 },
      { key: 'numRf', label: 'N° RF', x: 210, w: 65 },
      { key: 'dateFacture', label: 'Date facture', x: 280, w: 62 },
      { key: 'montantHt', label: 'Montant HT', x: 347, w: 68 },
      { key: 'montantTtc', label: 'Montant TTC', x: 420, w: 68 },
      { key: 'modePaiement', label: 'Mode paiement', x: 493, w: 78 },
      { key: 'datePaiement', label: 'Date paiement', x: 576, w: 68 },
    ]
    tableHeader(COLS_FF)
    for (const f of facturesFournisseur) {
      tableRowWrapped(COLS_FF, {
        numFacture: f.prefixe ? `${f.prefixe} ${f.numero_facture ?? ''}`.trim() : (f.numero_facture ?? '—'),
        piece: f.numero_piece_logiciel ?? '—',
        numRf: f.numero_rf ?? '—',
        dateFacture: fmtDate(f.date_facture),
        montantHt: fmtEuros(Number(f.montant_ht) || 0),
        montantTtc: f.montant_ttc != null ? fmtEuros(Number(f.montant_ttc)) : '—',
        modePaiement: f.mode_paiement ?? '—',
        datePaiement: fmtDate(f.date_paiement),
      })
    }
    ensureSpace(16)
    page.drawLine({ start: { x: 50, y: y + 12 }, end: { x: PAGE_W - 50, y: y + 12 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    tableRowSimple([{ text: 'TOTAL', x: 50, bold: true, color: brun }, { text: fmtEuros(totalFournisseurHt), x: 347, bold: true, color: brun }])
  }

  // ── Factures client ──────────────────────────────────────
  sectionTitle(`FACTURES CLIENT (${facturesClient.length})`)
  if (facturesClient.length === 0) {
    page.drawText('Aucune facture client.', { x: 50, y, font, size: 9, color: gray })
    y -= 16
  } else {
    const COLS_FC: Col[] = [
      { key: 'destinataire', label: 'Destinataire', x: 50, w: 130 },
      { key: 'numFacture', label: 'N° Facture', x: 185, w: 80 },
      { key: 'dateFacture', label: 'Date facture', x: 270, w: 65 },
      { key: 'montantHt', label: 'Montant HT', x: 340, w: 68 },
      { key: 'montantTtc', label: 'Montant TTC', x: 413, w: 68 },
      { key: 'modePaiement', label: 'Mode paiement', x: 486, w: 78 },
      { key: 'datePaiement', label: 'Date paiement', x: 569, w: 68 },
    ]
    tableHeader(COLS_FC)
    for (const f of facturesClient) {
      tableRowWrapped(COLS_FC, {
        destinataire: f.destinataire ?? '—',
        numFacture: f.numero_facture_logiciel ?? f.numero_facture ?? '—',
        dateFacture: fmtDate(f.date_facture),
        montantHt: fmtEuros(Number(f.montant_ht) || 0),
        montantTtc: f.montant_ttc != null ? fmtEuros(Number(f.montant_ttc)) : '—',
        modePaiement: f.mode_paiement ?? '—',
        datePaiement: fmtDate(f.date_paiement),
      })
    }
    ensureSpace(16)
    page.drawLine({ start: { x: 50, y: y + 12 }, end: { x: PAGE_W - 50, y: y + 12 }, thickness: 0.5, color: rgb(0.88, 0.88, 0.88) })
    tableRowSimple([{ text: 'TOTAL', x: 50, bold: true, color: brun }, { text: fmtEuros(totalClientHt), x: 340, bold: true, color: brun }])
  }

  // ── Bilan financier réel ─────────────────────────────────
  if (totalFournisseurHt > 0 || coutTransportReel > 0 || totalClientHt > 0) {
    sectionTitle('BILAN FINANCIER RÉEL')
    const marge = totalClientHt - totalFournisseurHt - coutTransportReel
    const margePct = totalClientHt > 0 ? (marge / totalClientHt) * 100 : null
    const margeParTonne = totalLivre > 0 ? marge / totalLivre : null
    rowPair(['CA client (HT)', totalClientHt > 0 ? fmtEuros(totalClientHt) : 'Non facturé'], ['Coût fournisseur (HT)', fmtEuros(totalFournisseurHt)])
    rowPair(['Coût transport réel', fmtEuros(coutTransportReel)], ['Marge brute', totalClientHt > 0 ? fmtEuros(marge) : '—'])
    rowPair(
      ['Marge / tonne', margeParTonne != null && totalClientHt > 0 ? fmtEurosT(margeParTonne) : null],
      ['Marge %', margePct != null ? `${margePct.toFixed(1)} %` : null]
    )
    if (totalClientHt === 0 && (totalFournisseurHt > 0 || coutTransportReel > 0)) {
      y -= 2
      page.drawText('Aucune facture client saisie — la marge ne peut pas être calculée.', { x: 50, y, font, size: 8.5, color: or })
      y -= 14
    }
  }

  // Pied de page sur chaque page
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
      'Content-Disposition': `attachment; filename="recap-${contrat.numero_contrat ?? contratId}.pdf"`,
    },
  })
}
