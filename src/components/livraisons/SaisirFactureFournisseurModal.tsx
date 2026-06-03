'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { formatTonnes, formatDate } from '@/lib/annee-agricole'

interface Props {
  livraison: any
  onClose: () => void
  onSaved: () => void
}

export default function SaisirFactureFournisseurModal({ livraison, onClose, onSaved }: Props) {
  const ca = livraison.contrat_achat
  const prefixeDefaut = ca?.famille === 'appro' ? 'FAF' : 'FAN'

  const [form, setForm] = useState({
    date_facture: '',
    numero_facture: '',
    prefixe: prefixeDefaut,
    montant_ht: '',
    montant_ttc: '',
    numero_rf: '',
    mode_paiement: '',
    date_paiement: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function f(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    // Créer la facture fournisseur
    const factureBody = {
      contrat_achat_id: ca?.id,
      livraison_id: livraison.id,
      date_facture: form.date_facture || null,
      numero_facture: form.numero_facture || null,
      prefixe: form.prefixe || null,
      montant_ht: form.montant_ht ? parseFloat(form.montant_ht) : null,
      montant_ttc: form.montant_ttc ? parseFloat(form.montant_ttc) : null,
      numero_piece_logiciel: form.numero_rf || null,
      mode_paiement: form.mode_paiement || null,
      date_paiement: form.date_paiement || null,
    }

    const res = await fetch('/api/factures/fournisseur', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(factureBody),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Erreur création facture')
      setSaving(false)
      return
    }

    const facture = await res.json()

    // Lier la facture à la livraison
    const patchRes = await fetch(`/api/livraisons/${livraison.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facture_fournisseur_id: facture.id }),
    })

    if (!patchRes.ok) {
      const d = await patchRes.json()
      setError(d.error ?? 'Facture créée mais liaison à la livraison échouée')
      setSaving(false)
      return
    }

    onSaved()
    setSaving(false)
  }

  return (
    <Modal title="Saisir la facture fournisseur" onClose={onClose} size="md">
      <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-2 text-sm text-amber-700 mb-4">
        <div className="font-semibold">{ca?.produit?.nom} · {ca?.numero_contrat}</div>
        <div className="text-xs mt-0.5">
          Fournisseur : <strong>{ca?.fournisseur?.nom ?? '—'}</strong> · {formatTonnes(livraison.quantite_reelle)} · {formatDate(livraison.date_reelle)}
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date de facturation *</label>
            <input type="date" className="input" value={form.date_facture} onChange={f('date_facture')} required />
          </div>
          <div>
            <label className="label">N° facture fournisseur *</label>
            <input className="input" value={form.numero_facture} onChange={f('numero_facture')} placeholder="Ex: 2026-0042" required />
          </div>
          <div>
            <label className="label">Pièce logiciel ({prefixeDefaut})</label>
            <div className="flex gap-1">
              <input className="input w-16 text-center font-mono" value={form.prefixe} onChange={f('prefixe')} />
              <span className="flex items-center text-gray-400 text-sm px-1">+</span>
              <span className="flex items-center text-xs text-gray-400">numéro saisi dans logiciel compta</span>
            </div>
          </div>
          <div>
            <label className="label">N° RF <span className="text-gray-400 font-normal">(optionnel — reçu avec la compta)</span></label>
            <input className="input" value={form.numero_rf} onChange={f('numero_rf')} placeholder="À compléter plus tard..." />
          </div>
          <div>
            <label className="label">Montant HT (€) *</label>
            <input type="number" step="0.01" className="input" value={form.montant_ht} onChange={f('montant_ht')} required />
          </div>
          <div>
            <label className="label">Montant TTC (€)</label>
            <input type="number" step="0.01" className="input" value={form.montant_ttc} onChange={f('montant_ttc')} />
          </div>
          <div>
            <label className="label">Mode de paiement <span className="text-gray-400 font-normal">(optionnel)</span></label>
            <select className="input" value={form.mode_paiement} onChange={f('mode_paiement')}>
              <option value="">— Non défini —</option>
              <option value="virement">Virement</option>
              <option value="cheque">Chèque</option>
              <option value="prelevement">Prélèvement</option>
              <option value="especes">Espèces</option>
            </select>
          </div>
          <div>
            <label className="label">Date de paiement <span className="text-gray-400 font-normal">(optionnel)</span></label>
            <input type="date" className="input" value={form.date_paiement} onChange={f('date_paiement')} />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : '✓ Valider facture fournisseur'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
