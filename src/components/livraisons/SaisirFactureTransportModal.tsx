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

  const montantPrevu = ca?.prix_transport_prevu ?? null
  const transporteurPrevu = montantPrevu != null ? montantPrevu.toFixed(2) : null

  const montantSaisi = form.montant_transport_reel ? parseFloat(form.montant_transport_reel) : null
  const ecart = montantPrevu != null && montantSaisi != null ? montantSaisi - montantPrevu : null
  const ecartPct = ecart != null && montantPrevu ? (ecart / montantPrevu) * 100 : null

  return (
    <Modal title="Saisir la facture transport" onClose={onClose} size="sm">
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-sm text-blue-700 mb-4">
        <div className="font-semibold">{ca?.produit?.nom} · {ca?.numero_contrat}</div>
        <div className="text-xs mt-0.5 text-blue-600">
          Transporteur : <strong>{ca?.transporteur?.nom ?? '—'}</strong> · {formatTonnes(livraison.quantite_reelle)} · {formatDate(livraison.date_reelle)}
        </div>
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
          <div className="flex items-center justify-between">
            <label className="label mb-0">Prix réel transport (€)</label>
            {transporteurPrevu && (
              <span className="text-xs text-gray-500">
                Prévu : <strong className="text-gray-700">{transporteurPrevu} €</strong>
              </span>
            )}
          </div>
          <input type="number" step="0.01" className="input" value={form.montant_transport_reel} onChange={f('montant_transport_reel')} placeholder={transporteurPrevu ?? 'Montant...'} />
          {ecart != null && Math.abs(ecart) >= 0.01 && (
            <p className={`text-xs mt-1 font-medium ${Math.abs(ecartPct ?? 0) > 5 ? 'text-red-600' : 'text-amber-600'}`}>
              {ecart > 0 ? '+' : ''}{ecart.toFixed(2)} € par rapport au prévu ({ecart > 0 ? '+' : ''}{ecartPct?.toFixed(1)} %)
            </p>
          )}
          {ecart != null && Math.abs(ecart) < 0.01 && (
            <p className="text-xs mt-1 font-medium text-green-600">✓ Conforme au montant prévu</p>
          )}
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
