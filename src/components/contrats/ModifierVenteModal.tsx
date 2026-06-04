'use client'
import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'

interface Props {
  vente: any
  contrat: any
  onClose: () => void
  onSaved: () => void
}

export default function ModifierVenteModal({ vente, contrat, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    numero_contrat: vente.numero_contrat ?? '',
    agriculteur_id: vente.agriculteur_id ?? '',
    prix_vente: String(vente.prix_vente ?? ''),
    quantite: String(vente.quantite ?? ''),
    statut: vente.statut ?? 'en_cours',
    date_debut: vente.date_debut ?? '',
    date_fin: vente.date_fin ?? '',
    notes: vente.notes ?? '',
  })
  const [agriculteurs, setAgriculteurs] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/referentiels/agriculteurs').then(r => r.json()).then(setAgriculteurs)
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
      agriculteur_id: form.agriculteur_id,
      prix_vente: parseFloat(form.prix_vente),
      quantite: parseFloat(form.quantite),
      statut: form.statut,
      date_debut: form.date_debut || null,
      date_fin: form.date_fin || null,
      notes: form.notes || null,
    }
    const res = await fetch(`/api/ventes/${vente.id}`, {
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

  return (
    <Modal title="Modifier le contrat de vente" onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="bg-green-50 rounded-lg px-4 py-2 text-sm text-green-700 mb-2">
          Produit : <strong>{contrat.produit?.nom}</strong> · Contrat achat : <strong>{contrat.numero_contrat}</strong>
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
          <div>
            <label className="label">Date début</label>
            <input type="date" className="input" value={form.date_debut} onChange={f('date_debut')} />
          </div>
          <div>
            <label className="label">Date fin</label>
            <input type="date" className="input" value={form.date_fin} onChange={f('date_fin')} />
          </div>
          <div>
            <label className="label">Statut</label>
            <select className="input" value={form.statut} onChange={f('statut')}>
              <option value="en_cours">En cours</option>
              <option value="clos">Clos</option>
              <option value="annule">Annulé</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={f('notes')} placeholder="Informations complémentaires..." />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
