'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { formatTonnes, formatDate } from '@/lib/annee-agricole'

interface Props {
  livraison: any
  onClose: () => void
  onSaved: () => void
}

export default function SaisirFactureTransportModal({ livraison, onClose, onSaved }: Props) {
  const ca = livraison.contrat_achat
  const [form, setForm] = useState({
    date_facture_transport: livraison.date_facture_transport ?? '',
    numero_facture_transport: livraison.numero_facture_transport ?? '',
    montant_transport_reel: livraison.montant_transport_reel ? String(livraison.montant_transport_reel) : '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function f(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const body: any = {
      date_facture_transport: form.date_facture_transport || null,
      numero_facture_transport: form.numero_facture_transport || null,
      montant_transport_reel: form.montant_transport_reel ? parseFloat(form.montant_transport_reel) : null,
      transport_facture: true,
    }
    const res = await fetch(`/api/livraisons/${livraison.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) { onSaved() } else {
      const d = await res.json()
      setError(d.error ?? 'Erreur')
    }
    setSaving(false)
  }

  const transporteurPrevu = ca?.prix_transport_prevu && livraison.quantite_reelle
    ? (ca.prix_transport_prevu * livraison.quantite_reelle).toFixed(2)
    : null

  return (
    <Modal title="Saisir la facture transport" onClose={onClose} size="sm">
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-sm text-blue-700 mb-4">
        <div className="font-semibold">{ca?.produit?.nom} · {ca?.numero_contrat}</div>
        <div className="text-xs mt-0.5 text-blue-600">
          Transporteur : <strong>{ca?.transporteur?.nom ?? '—'}</strong> · {formatTonnes(livraison.quantite_reelle)} · {formatDate(livraison.date_reelle)}
        </div>
        {transporteurPrevu && (
          <div className="text-xs mt-0.5 text-blue-500">Montant prévu : {transporteurPrevu} €</div>
        )}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Date de réception de la facture *</label>
          <input type="date" className="input" value={form.date_facture_transport} onChange={f('date_facture_transport')} required />
        </div>
        <div>
          <label className="label">Numéro de facture *</label>
          <input className="input" value={form.numero_facture_transport} onChange={f('numero_facture_transport')} placeholder="Ex: FAT-2026-0042" required />
        </div>
        <div>
          <label className="label">Prix réel transport (€)</label>
          <input type="number" step="0.01" className="input" value={form.montant_transport_reel} onChange={f('montant_transport_reel')} placeholder={transporteurPrevu ?? 'Montant...'} />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : '✓ Valider facture transport'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
