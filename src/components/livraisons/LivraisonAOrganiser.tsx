'use client'
import { useState } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'
import { formatTonnes, formatMois } from '@/lib/annee-agricole'

interface Props {
  livraison: any
  moisCourant: string
  moisSuivant: string
  isAdmin?: boolean
  onConfirme: () => void  // appelé quand transporteur_contacte → reload dashboard
  onDelete?: () => void
}

export default function LivraisonAOrganiser({ livraison: l, moisCourant, moisSuivant, isAdmin, onConfirme, onDelete }: Props) {
  // État local propre à cette livraison — initialisé depuis le serveur, géré localement
  const [agri, setAgri] = useState(!!l.agriculteur_contacte)
  const [pdf, setPdf] = useState(!!l.pdf_envoye)
  const [transporteur, setTransporteur] = useState(!!l.transporteur_contacte)
  const [dateSouhaitee, setDateSouhaitee] = useState(l.date_souhaitee ?? '')
  const [semaineSouhaitee, setSemaineSouhaitee] = useState(l.semaine_souhaitee ?? '')
  const [datePrevue, setDatePrevue] = useState(l.date_prevue ?? '')
  const [semainePrevue, setSemainePrevue] = useState(l.semaine_prevue ?? '')
  const [saving, setSaving] = useState(false)

  const ca = l.contrat_achat
  const agriDest = (ca?.contrats_vente ?? []).find((cv: any) => cv.id === l.contrat_vente_id)?.agriculteur
    ?? ca?.contrats_vente?.[0]?.agriculteur
  const moisLiv = l.mois_prevu?.slice(0, 7) ?? ''
  const isRetard = moisLiv < moisCourant.slice(0, 7)
  const isProchain = moisSuivant && moisLiv >= moisSuivant.slice(0, 7)

  const step1ok = agri || !!dateSouhaitee || !!semaineSouhaitee
  const step2ok = step1ok && pdf
  const step3ok = transporteur
  const etapeActive = step3ok ? 0 : step2ok ? 3 : step1ok ? 2 : 1

  async function patch(body: object) {
    await fetch(`/api/livraisons/${l.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async function toggleAgri() {
    const val = !agri
    setAgri(val)
    await patch({ agriculteur_contacte: val })
  }

  async function togglePdf() {
    const val = !pdf
    setPdf(val)
    await patch({ pdf_envoye: val })
  }

  async function toggleTransporteur() {
    const val = !transporteur
    setTransporteur(val)
    setSaving(true)
    await patch({ transporteur_contacte: val })
    if (val) {
      // Case cochée → passe en CMR → recharger le dashboard
      onConfirme()
    }
    setSaving(false)
  }

  async function saveDate(field: string, value: string) {
    if (field === 'date_souhaitee') {
      setDateSouhaitee(value)
      await patch({ date_souhaitee: value || null, semaine_souhaitee: value ? null : undefined, agriculteur_contacte: !!value || agri })
      if (value) setAgri(true)
    } else if (field === 'semaine_souhaitee') {
      setSemaineSouhaitee(value)
      await patch({ semaine_souhaitee: value || null, date_souhaitee: value ? null : undefined, agriculteur_contacte: !!value || agri })
      if (value) setAgri(true)
    } else if (field === 'date_prevue') {
      setDatePrevue(value)
      await patch({ date_prevue: value || null, semaine_prevue: null })
    } else if (field === 'semaine_prevue') {
      setSemainePrevue(value)
      await patch({ semaine_prevue: value || null, date_prevue: null })
    }
  }

  return (
    <div className={`px-5 py-4 ${isRetard ? 'bg-red-50/40' : isProchain ? 'bg-blue-50/40' : ''}`}>
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
            isRetard ? 'bg-red-100 text-red-700' : isProchain ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
          }`}>{isRetard ? '⚠️ ' : isProchain ? '→ ' : ''}{formatMois(l.mois_prevu)}</span>
          <span className="font-semibold text-gray-800">{ca?.produit?.nom}</span>
          <span className="text-gray-500 text-sm">{ca?.fournisseur?.nom}</span>
          <span className="text-gray-400">·</span>
          <span className="text-sm font-medium" style={{ color: '#7B2820' }}>{formatTonnes(l.quantite_prevue)}</span>
          <span className="text-gray-400">·</span>
          <span className="text-sm text-gray-600">{[agriDest?.civilite, agriDest?.nom].filter(Boolean).join(' ') || '—'}</span>
          <span className="text-gray-400">·</span>
          <span className="text-sm text-gray-500">{ca?.transporteur?.nom ?? '—'}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ca?.famille === 'appro' && !l.numero_mise_a_disposition && (
            <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700" title="N° de mise à disposition manquant — requis pour le transporteur">
              <AlertTriangle size={11} /> N° MAD manquant
            </span>
          )}
          <a href={`/contrats/${ca?.id}`} className="text-xs text-green-700 hover:underline">{ca?.numero_contrat}</a>
          {isAdmin && onDelete && (
            <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded" title="Supprimer la livraison">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 3 étapes */}
      <div className={`grid grid-cols-3 gap-3 ${step3ok ? 'opacity-50' : ''}`}>

        {/* Étape 1 — Agri contacté */}
        <div className={`rounded-lg p-3 border-2 transition-all ${
          step1ok ? 'border-green-200 bg-green-50' :
          etapeActive === 1 ? 'border-blue-400 bg-blue-50 shadow-sm' : 'border-gray-100 bg-gray-50'
        }`}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step1ok ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}`}>1</span>
            <span className="text-xs font-semibold text-blue-700">📞 Agri contacté</span>
          </div>
          {agriDest?.telephone && (
            <a href={`tel:${agriDest.telephone}`} className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline mb-2">
              📞 {agriDest.telephone}
            </a>
          )}
          <label className="flex items-center gap-2 cursor-pointer mb-2" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={agri}
              onChange={toggleAgri}
              className="w-4 h-4 cursor-pointer accent-blue-600"
            />
            <span className={`text-xs font-medium ${agri ? 'text-green-700' : 'text-gray-700'}`}>
              {agri ? '✓ Agri contacté' : 'Agri contacté'}
            </span>
          </label>
          <p className="text-xs text-gray-400 mb-1">Date ou semaine souhaitée :</p>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 w-12 shrink-0">Date :</span>
              <input
                type="date"
                value={dateSouhaitee}
                onChange={e => setDateSouhaitee(e.target.value)}
                onBlur={e => saveDate('date_souhaitee', e.target.value)}
                className="text-xs border border-gray-200 rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 w-12 shrink-0">Semaine :</span>
              <input
                type="text"
                placeholder="ex: S23"
                value={semaineSouhaitee}
                onChange={e => setSemaineSouhaitee(e.target.value)}
                onBlur={e => saveDate('semaine_souhaitee', e.target.value)}
                className="text-xs border border-gray-200 rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
        </div>

        {/* Étape 2 — PDF transporteur */}
        <div className={`rounded-lg p-3 border-2 transition-all ${
          step2ok ? 'border-green-200 bg-green-50' :
          etapeActive === 2 ? 'border-orange-400 bg-orange-50 shadow-sm' :
          step1ok ? 'border-orange-100 bg-orange-50/30' : 'border-gray-100 bg-gray-50 opacity-50'
        }`}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step2ok ? 'bg-green-500 text-white' : etapeActive === 2 ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'}`}>2</span>
            <span className={`text-xs font-semibold ${etapeActive === 2 ? 'text-orange-700' : 'text-gray-700'}`}>📄 PDF transporteur</span>
          </div>
          {step1ok ? (
            <div className="text-xs text-gray-600 space-y-2">
              {(dateSouhaitee || semaineSouhaitee) && (
                <p className="text-gray-400">Souhait agri : <strong className="text-gray-700">
                  {dateSouhaitee ? new Date(dateSouhaitee).toLocaleDateString('fr-FR') : semaineSouhaitee}
                </strong></p>
              )}
              <a
                href={`/api/pdf/transporteur?livraison_id=${l.id}`}
                target="_blank" rel="noopener noreferrer"
                onClick={() => { if (!pdf) { setPdf(true); patch({ pdf_envoye: true }) } }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-medium"
                style={{ backgroundColor: pdf ? '#16a34a' : '#7B2820' }}>
                {pdf ? '✓ PDF envoyé' : '📥 Télécharger PDF'}
              </a>
              <label className="flex items-center gap-2 cursor-pointer mt-1" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={pdf}
                  onChange={togglePdf}
                  className="w-4 h-4 cursor-pointer accent-orange-600"
                />
                <span className={`text-xs ${pdf ? 'text-green-700' : 'text-gray-500'}`}>
                  {pdf ? '✓ Demande envoyée' : 'Demande envoyée'}
                </span>
              </label>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Compléter l'étape 1 d'abord</p>
          )}
        </div>

        {/* Étape 3 — Transporteur confirmé */}
        <div className={`rounded-lg p-3 border-2 transition-all ${
          step3ok ? 'border-green-200 bg-green-50' :
          etapeActive === 3 ? 'border-green-400 bg-green-50 shadow-sm' :
          step1ok ? 'border-green-100 bg-green-50/30' : 'border-gray-100 bg-gray-50 opacity-50'
        }`}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step3ok ? 'bg-green-500 text-white' : etapeActive === 3 ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'}`}>3</span>
            <span className={`text-xs font-semibold ${etapeActive === 3 ? 'text-green-700' : 'text-gray-700'}`}>🚛 Transporteur confirmé</span>
          </div>
          {ca?.transporteur?.telephone && (
            <a href={`tel:${ca.transporteur.telephone}`} className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:underline mb-2">
              📞 {ca.transporteur.telephone}
            </a>
          )}
          {step1ok ? (
            <>
              <label className="flex items-center gap-2 cursor-pointer mb-2" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={transporteur}
                  onChange={toggleTransporteur}
                  disabled={saving}
                  className="w-4 h-4 cursor-pointer accent-green-600 disabled:opacity-50"
                />
                <span className={`text-xs font-medium ${transporteur ? 'text-green-700' : 'text-gray-700'}`}>
                  {saving ? '⏳ Passage en CMR…' : transporteur ? '✓ Confirmé → CMR' : 'Transporteur confirmé'}
                </span>
              </label>
              <p className="text-xs text-gray-400 mb-1">Date <strong>ou</strong> semaine :</p>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400 w-12 shrink-0">Date :</span>
                  <input
                    type="date"
                    value={datePrevue}
                    onChange={e => setDatePrevue(e.target.value)}
                    onBlur={e => saveDate('date_prevue', e.target.value)}
                    className="text-xs border border-gray-200 rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:border-green-400"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400 w-12 shrink-0">Semaine :</span>
                  <input
                    type="text"
                    placeholder="ex: S23"
                    value={semainePrevue}
                    onChange={e => setSemainePrevue(e.target.value)}
                    onBlur={e => saveDate('semaine_prevue', e.target.value)}
                    className="text-xs border border-gray-200 rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:border-green-400"
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400">Compléter l'étape 1 d'abord</p>
          )}
        </div>
      </div>
    </div>
  )
}
