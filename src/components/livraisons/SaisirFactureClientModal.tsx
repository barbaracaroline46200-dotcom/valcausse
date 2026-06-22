'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { formatDate, formatTonnes } from '@/lib/annee-agricole'

interface Livraison {
  id: string
  date_reelle?: string
  quantite_reelle?: number
  contrat_achat?: any
  contrat_vente_id?: string
}

interface Props {
  livraisons: Livraison[]
  onClose: () => void
  onSaved: () => void
}

export default function SaisirFactureClientModal({ livraisons, onClose, onSaved }: Props) {
  const [numeroFacture, setNumeroFacture] = useState('')
  const [montantHt, setMontantHt] = useState('')
  const [montantTtc, setMontantTtc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Toutes les livraisons sont forcément du même contrat_vente
  const cv = livraisons[0]?.contrat_achat?.contrats_vente?.find(
    (v: any) => v.id === livraisons[0]?.contrat_vente_id
  )
  const agri = cv?.agriculteur
  const produit = livraisons[0]?.contrat_achat?.produit?.nom ?? '—'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!numeroFacture.trim()) { setError('Le N° de facture est obligatoire'); return }
    setSaving(true)
    setError('')

    const res = await fetch('/api/factures/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contrat_vente_id: livraisons[0].contrat_vente_id,
        numero_facture_logiciel: numeroFacture.trim(),
        montant_ht: montantHt ? parseFloat(montantHt) : null,
        montant_ttc: montantTtc ? parseFloat(montantTtc) : null,
        livraison_ids: livraisons.map(l => l.id),
      }),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Erreur lors de la saisie')
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <Modal title="Saisir facture client" onClose={onClose} size="md">
      {/* Récap livraisons concernées */}
      <div className="mb-5 rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Livraison{livraisons.length > 1 ? 's' : ''} concernée{livraisons.length > 1 ? 's' : ''} ({livraisons.length})
        </div>
        <table className="w-full text-sm">
          <tbody>
            {livraisons.map(l => {
              const ca = l.contrat_achat
              return (
                <tr key={l.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2 text-gray-500">{formatDate(l.date_reelle)}</td>
                  <td className="px-4 py-2 font-medium">{produit}</td>
                  <td className="px-4 py-2 text-gray-500">{ca?.numero_contrat ?? '—'}</td>
                  <td className="px-4 py-2 font-semibold text-right">{formatTonnes(l.quantite_reelle)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {agri && (
          <div className="px-4 py-2 bg-blue-50 text-sm text-blue-800 font-medium">
            {[agri.civilite, agri.nom].filter(Boolean).join(' ')}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">N° de facture *</label>
          <input
            className="input"
            value={numeroFacture}
            onChange={e => setNumeroFacture(e.target.value)}
            placeholder="Ex : FAT-2026-0042"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Montant HT (€)</label>
            <input type="number" step="0.01" className="input" value={montantHt} onChange={e => setMontantHt(e.target.value)} />
          </div>
          <div>
            <label className="label">Montant TTC (€)</label>
            <input type="number" step="0.01" className="input" value={montantTtc} onChange={e => setMontantTtc(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Enregistrement...' : '✓ Saisir la facture'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
