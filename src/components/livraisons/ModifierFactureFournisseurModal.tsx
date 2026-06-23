'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { formatDate } from '@/lib/annee-agricole'

interface Props {
  facture: any
  onClose: () => void
  onSaved: () => void
}

const MODES_PAIEMENT = [
  { value: 'virement', label: 'Virement' },
  { value: 'prelevement', label: 'Prélèvement' },
  { value: 'lcr', label: 'LCR' },
]

export default function ModifierFactureFournisseurModal({ facture, onClose, onSaved }: Props) {
  const prefixe = facture.prefixe ?? 'FAN'
  // Séparer le préfixe du numéro dans numero_piece_logiciel
  const pieceNum = facture.numero_piece_logiciel
    ? facture.numero_piece_logiciel.replace(new RegExp(`^${prefixe}`), '')
    : ''

  const [form, setForm] = useState({
    numero_facture: facture.numero_facture ?? '',
    numero_piece_logiciel_num: pieceNum,
    date_facture: facture.date_facture ?? '',
    montant_ht: facture.montant_ht != null ? String(facture.montant_ht) : '',
    montant_ttc: facture.montant_ttc != null ? String(facture.montant_ttc) : '',
    mode_paiement: facture.mode_paiement ?? '',
    date_paiement: facture.date_paiement ?? '',
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
    setError('')
    const body = {
      numero_facture: form.numero_facture.trim() || null,
      numero_piece_logiciel: form.numero_piece_logiciel_num.trim()
        ? `${prefixe}${form.numero_piece_logiciel_num.trim()}`
        : null,
      date_facture: form.date_facture || null,
      montant_ht: form.montant_ht ? parseFloat(form.montant_ht) : null,
      montant_ttc: form.montant_ttc ? parseFloat(form.montant_ttc) : null,
      mode_paiement: form.mode_paiement || null,
      date_paiement: form.date_paiement || null,
    }
    const res = await fetch(`/api/factures/fournisseur/${facture.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Erreur lors de la modification')
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <Modal title="Modifier la facture fournisseur" onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">N° facture fournisseur</label>
            <input className="input" value={form.numero_facture} onChange={f('numero_facture')} placeholder="Ex: 2026-FA-0042" />
          </div>
          <div className="col-span-2">
            <label className="label">N° {prefixe} dans Atys</label>
            <div className="flex gap-1 items-center">
              <span className="input w-16 text-center bg-gray-50 text-gray-500 font-mono text-sm flex items-center justify-center">{prefixe}</span>
              <input className="input flex-1" value={form.numero_piece_logiciel_num} onChange={f('numero_piece_logiciel_num')} placeholder="numéro dans logiciel compta" />
            </div>
          </div>
          <div>
            <label className="label">Date de facturation</label>
            <input type="date" className="input" value={form.date_facture} onChange={f('date_facture')} />
          </div>
          <div>
            <label className="label">Mode de paiement</label>
            <select className="input" value={form.mode_paiement} onChange={f('mode_paiement')}>
              <option value="">— Non défini —</option>
              {MODES_PAIEMENT.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Montant HT (€)</label>
            <input type="number" step="0.01" className="input" value={form.montant_ht} onChange={f('montant_ht')} />
          </div>
          <div>
            <label className="label">Montant TTC (€)</label>
            <input type="number" step="0.01" className="input" value={form.montant_ttc} onChange={f('montant_ttc')} />
          </div>
          <div className="col-span-2">
            <label className="label">Date de paiement</label>
            <input type="date" className="input" value={form.date_paiement} onChange={f('date_paiement')} />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Enregistrement...' : '✓ Enregistrer les modifications'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
