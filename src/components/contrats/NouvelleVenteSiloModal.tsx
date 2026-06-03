'use client'
import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'

interface Props {
  onClose: () => void
  onSaved: () => void
}

export default function NouvelleVenteSiloModal({ onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    numero_contrat: '', produit_id: '', agriculteur_id: '', prix_vente: '', quantite: '', notes: '', date_debut: '', date_fin: '',
  })
  const [produits, setProduits] = useState<any[]>([])
  const [agriculteurs, setAgriculteurs] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/referentiels/produits').then(r => r.json()),
      fetch('/api/referentiels/agriculteurs').then(r => r.json()),
    ]).then(([p, a]) => { setProduits(p); setAgriculteurs(a) })
  }, [])

  function f(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const body = {
      numero_contrat: form.numero_contrat,
      contrat_achat_id: null,
      produit_id: form.produit_id,
      agriculteur_id: form.agriculteur_id,
      prix_vente: parseFloat(form.prix_vente),
      quantite: parseFloat(form.quantite),
      notes: form.notes || null,
      date_debut: form.date_debut || null,
      date_fin: form.date_fin || null,
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

  return (
    <Modal title="Nouveau contrat de vente — Départ silo" onClose={onClose} size="md">
      <p className="text-sm text-gray-500 mb-4">Ce contrat n'est pas lié à un contrat d'achat (départ silo).</p>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">N° contrat *</label>
            <input className="input" value={form.numero_contrat} onChange={f('numero_contrat')} required />
          </div>
          <div>
            <label className="label">Produit *</label>
            <select className="input" value={form.produit_id} onChange={f('produit_id')} required>
              <option value="">Choisir...</option>
              {produits.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Agriculteur *</label>
            <select className="input" value={form.agriculteur_id} onChange={f('agriculteur_id')} required>
              <option value="">Choisir...</option>
              {agriculteurs.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
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
          <div>
            <label className="label">Date début contrat</label>
            <input type="date" className="input" value={form.date_debut} onChange={f('date_debut')} />
          </div>
          <div>
            <label className="label">Date fin contrat</label>
            <input type="date" className="input" value={form.date_fin} onChange={f('date_fin')} />
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
