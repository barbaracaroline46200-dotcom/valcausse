'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { formatDate, formatTonnes } from '@/lib/annee-agricole'

interface LivraisonAvecPrix {
  livraison: any
  montant: string
}

interface Props {
  selections: LivraisonAvecPrix[]
  onClose: () => void
  onSaved: () => void
}

export default function SaisirFactureTransportGroupeModal({ selections, onClose, onSaved }: Props) {
  const transporteurNom = selections[0]?.livraison?.contrat_achat?.transporteur?.nom ?? '—'
  const totalTonnes = selections.reduce((s, { livraison: l }) => s + (l.quantite_reelle ?? 0), 0)
  // montant = prix par tonne saisi pour cette livraison → coût réel = prix × tonnage
  const totalMontant = selections.reduce((s, { livraison: l, montant }) => s + (parseFloat(montant) || 0) * (l.quantite_reelle ?? 0), 0)

  const [dateFacture, setDateFacture] = useState('')
  const [numeroFacture, setNumeroFacture] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!numeroFacture.trim()) { setError('Le N° de facture est obligatoire'); return }
    setSaving(true)
    setError('')

    await Promise.all(selections.map(({ livraison: l, montant }) =>
      fetch(`/api/livraisons/${l.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montant_transport_reel: parseFloat(montant),
          date_facture_transport: dateFacture || null,
          numero_facture_transport: numeroFacture.trim(),
          transport_facture: true,
        }),
      })
    ))

    onSaved()
  }

  return (
    <Modal title="Saisir la facture transport" onClose={onClose} size="md">
      {/* Récap */}
      <div className="mb-5 rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {selections.length} transport{selections.length > 1 ? 's' : ''} · {transporteurNom}
          </span>
          <span className="text-xs font-bold text-gray-700">{formatTonnes(totalTonnes)} · coût total {totalMontant.toFixed(2)} €</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400">
              <th className="px-4 py-1 text-left font-normal">Date</th>
              <th className="px-4 py-1 text-left font-normal">Produit</th>
              <th className="px-4 py-1 text-left font-normal">Agri</th>
              <th className="px-4 py-1 text-right font-normal">Tonnes</th>
              <th className="px-4 py-1 text-right font-normal">Prévu €/t</th>
              <th className="px-4 py-1 text-right font-normal">Réel €/t</th>
              <th className="px-4 py-1 text-right font-normal">Écart €/t</th>
            </tr>
          </thead>
          <tbody>
            {selections.map(({ livraison: l, montant }) => {
              const ca = l.contrat_achat
              const agri = ca?.contrats_vente?.find((v: any) => v.id === l.contrat_vente_id)?.agriculteur
              const prevu = ca?.prix_transport_prevu ?? null
              const ecart = prevu != null ? parseFloat(montant) - prevu : null
              return (
                <tr key={l.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-1.5 text-gray-500">{formatDate(l.date_reelle)}</td>
                  <td className="px-4 py-1.5">{ca?.produit?.nom ?? '—'}</td>
                  <td className="px-4 py-1.5 text-gray-500">{agri?.nom ?? '—'}</td>
                  <td className="px-4 py-1.5 text-right">{formatTonnes(l.quantite_reelle)}</td>
                  <td className="px-4 py-1.5 text-right text-gray-400">{prevu != null ? `${prevu.toFixed(2)} €` : '—'}</td>
                  <td className="px-4 py-1.5 font-semibold text-right text-amber-700">{parseFloat(montant).toFixed(2)} €</td>
                  <td className="px-4 py-1.5 text-right">
                    {ecart != null && (
                      Math.abs(ecart) < 0.01
                        ? <span className="text-xs text-green-600 font-medium">✓</span>
                        : <span className={`text-xs font-medium ${ecart > 0 ? 'text-red-600' : 'text-amber-600'}`}>{ecart > 0 ? '+' : ''}{ecart.toFixed(2)} €</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date de la facture</label>
            <input type="date" className="input" value={dateFacture} onChange={e => setDateFacture(e.target.value)} />
          </div>
          <div>
            <label className="label">N° de facture *</label>
            <input className="input" value={numeroFacture} onChange={e => setNumeroFacture(e.target.value)}
              placeholder="Ex: FAT-2026-0042" autoFocus />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Enregistrement...' : '✓ Valider la facture'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
