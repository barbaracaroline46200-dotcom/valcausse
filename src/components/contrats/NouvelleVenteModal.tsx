'use client'
import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'

interface Props {
  contrat: any
  onClose: () => void
  onSaved: () => void
}

export default function NouvelleVenteModal({ contrat, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    numero_contrat: '', agriculteur_id: '', prix_vente: '', quantite: '', notes: '',
  })
  const [agriculteurs, setAgriculteurs] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/referentiels/agriculteurs').then(r => r.json()).then(setAgriculteurs)
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const body = {
      numero_contrat: form.numero_contrat,
      contrat_achat_id: contrat.id,
      produit_id: contrat.produit_id,
      agriculteur_id: form.agriculteur_id,
      prix_vente: parseFloat(form.prix_vente),
      quantite: parseFloat(form.quantite),
      notes: form.notes || null,
    }
    const res = await fetch('/api/ventes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) { onSaved() } else {
      const d = await res.json()
      setError(d.error ?? 'Erreur')
    }
    setSaving(false)
  }

  function f(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  return (
    <Modal title="Nouveau contrat de vente lié" onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="bg-green-50 rounded-lg px-4 py-2 text-sm text-green-700 mb-2">
          Produit : <strong>{contrat.produit?.nom}</strong>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">N° contrat *</label>
            <input className="input" value={form.numero_contrat} onChange={f('numero_contrat')} required />
          </div>
          <div>
            <label className="label">Agriculteur *</label>
            <select className="input" value={form.agriculteur_id} onChange={f('agriculteur_id')} required>
              <option value="">Choisir...</option>
              {agriculteurs.map((a: any) => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Prix vente (€/t) *</label>
            <input type="number" step="0.01" className="input" value={form.prix_vente} onChange={f('prix_vente')} required />
          </div>
          <div>
            <label className="label">Quantité (t) *</label>
            <input type="number" step="0.001" className="input" value={form.quantite} onChange={f('quantite')} required />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={f('notes')} />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
