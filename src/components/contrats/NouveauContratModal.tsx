'use client'
import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'

interface Props {
  onClose: () => void
  onSaved: () => void
}

export default function NouveauContratModal({ onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    numero_contrat: '', famille: 'negoce', produit_id: '', fournisseur_id: '',
    courtier_id: '', reference_fournisseur: '',
    prix_achat: '', quantite_totale: '', transporteur_id: '', prix_transport_prevu: '0',
    point_chargement: '', ville_chargement: '', date_conclusion: '', date_debut: '', date_fin: '',
    notes: '',
  })
  const [produits, setProduits] = useState<any[]>([])
  const [fournisseurs, setFournisseurs] = useState<any[]>([])
  const [courtiers, setCourtiers] = useState<any[]>([])
  const [transporteurs, setTransporteurs] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/referentiels/produits').then(r => r.json()),
      fetch('/api/referentiels/fournisseurs').then(r => r.json()),
      fetch('/api/referentiels/courtiers').then(r => r.json()),
      fetch('/api/referentiels/transporteurs').then(r => r.json()),
    ]).then(([p, f, c, t]) => { setProduits(p); setFournisseurs(f); setCourtiers(c); setTransporteurs(t) })
  }, [])

  const produitsFiltres = produits.filter(p => p.famille === form.famille)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body = {
      ...form,
      courtier_id: form.courtier_id || null,
      date_conclusion: form.date_conclusion || null,
      prix_achat: parseFloat(form.prix_achat),
      quantite_totale: parseFloat(form.quantite_totale),
      prix_transport_prevu: parseFloat(form.prix_transport_prevu),
      date_debut: form.date_debut || null,
      date_fin: form.date_fin || null,
    }
    const res = await fetch('/api/contrats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) { onSaved() } else {
      const d = await res.json()
      setError(d.error ?? 'Erreur lors de la sauvegarde')
    }
    setSaving(false)
  }

  function f(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }))
    }
  }

  return (
    <Modal title="Nouveau contrat d'achat" onClose={onClose} size="xl">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">N° contrat *</label>
            <input className="input" value={form.numero_contrat} onChange={f('numero_contrat')} required />
          </div>
          <div>
            <label className="label">Famille *</label>
            <select className="input" value={form.famille} onChange={f('famille')}>
              <option value="negoce">Négoce</option>
              <option value="appro">Appro</option>
            </select>
          </div>
          <div>
            <label className="label">Produit *</label>
            <select className="input" value={form.produit_id} onChange={f('produit_id')} required>
              <option value="">Choisir...</option>
              {produitsFiltres.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fournisseur *</label>
            <select className="input" value={form.fournisseur_id} onChange={f('fournisseur_id')} required>
              <option value="">Choisir...</option>
              {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Référence fournisseur</label>
            <input className="input" value={form.reference_fournisseur} onChange={f('reference_fournisseur')} />
          </div>
          <div>
            <label className="label">Courtier</label>
            <select className="input" value={form.courtier_id} onChange={f('courtier_id')}>
              <option value="">Sans courtier</option>
              {courtiers.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Prix achat (€/t) *</label>
            <input type="number" step="0.01" className="input" value={form.prix_achat} onChange={f('prix_achat')} required />
          </div>
          <div>
            <label className="label">Quantité totale (t) *</label>
            <input type="number" step="0.001" className="input" value={form.quantite_totale} onChange={f('quantite_totale')} required />
          </div>
          <div>
            <label className="label">Transporteur *</label>
            <select className="input" value={form.transporteur_id} onChange={f('transporteur_id')} required>
              <option value="">Choisir...</option>
              {transporteurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Prix transport prévu (€/t)</label>
            <input type="number" step="0.01" className="input" value={form.prix_transport_prevu} onChange={f('prix_transport_prevu')} />
          </div>
          <div className="col-span-2">
            <label className="label">Point de chargement</label>
            <input className="input" value={form.point_chargement} onChange={f('point_chargement')} placeholder="Adresse complète..." />
          </div>
          <div>
            <label className="label">Ville de chargement</label>
            <input className="input" value={form.ville_chargement} onChange={f('ville_chargement')} />
          </div>
          <div>
            <label className="label">Date conclusion</label>
            <input type="date" className="input" value={form.date_conclusion} onChange={f('date_conclusion')} />
          </div>
          <div>
            <label className="label">Date début</label>
            <input type="date" className="input" value={form.date_debut} onChange={f('date_debut')} />
          </div>
          <div>
            <label className="label">Date fin</label>
            <input type="date" className="input" value={form.date_fin} onChange={f('date_fin')} />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={f('notes')} />
          </div>
        </div>

        {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : 'Créer le contrat'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
