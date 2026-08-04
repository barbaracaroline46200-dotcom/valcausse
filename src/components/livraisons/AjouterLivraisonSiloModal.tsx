'use client'
import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { getPrefixes } from '@/lib/prefixes'

interface Props {
  vente: any
  onClose: () => void
  onSaved: () => void
}

export default function AjouterLivraisonSiloModal({ vente, onClose, onSaved }: Props) {
  const famille = vente.produit?.famille ?? 'negoce'
  const prefixes = getPrefixes(famille)
  const [transporteurs, setTransporteurs] = useState<any[]>([])

  const [form, setForm] = useState({
    mois_prevu: '',
    quantite_prevue: '',
    ville_chargement: '',
    ville_destination: vente.agriculteur?.ville_livraison ?? '',
    transporteur_id: '',
    piece_client_prefixe: prefixes.client,
    piece_client_numero: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/referentiels/transporteurs').then(r => r.json()).then(setTransporteurs)
  }, [])

  function f(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.transporteur_id) { setError('Le transporteur est obligatoire — il n\'y a pas de contrat d\'achat pour en fournir un par défaut'); return }
    setSaving(true)
    setError('')
    const body = {
      contrat_achat_id: null,
      contrat_vente_id: vente.id,
      type: 'planifiee',
      mois_prevu: form.mois_prevu + '-01',
      quantite_prevue: parseFloat(form.quantite_prevue),
      ville_chargement: form.ville_chargement || null,
      ville_destination: form.ville_destination || null,
      transporteur_id: form.transporteur_id,
      piece_client_prefixe: form.piece_client_prefixe || null,
      piece_client_numero: form.piece_client_numero || null,
    }
    const res = await fetch('/api/livraisons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) { onSaved() } else {
      const d = await res.json()
      setError(d.error ?? 'Erreur')
      setSaving(false)
    }
  }

  return (
    <Modal title="Ajouter une livraison — départ silo" onClose={onClose} size="md">
      <p className="text-sm text-gray-500 mb-4">
        Vente directe sans contrat d'achat lié — choisissez le transporteur pour cette livraison.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Mois prévu *</label>
            <input type="month" className="input" value={form.mois_prevu} onChange={f('mois_prevu')} required />
          </div>
          <div>
            <label className="label">Quantité prévue (t) *</label>
            <input type="number" step="0.001" className="input" value={form.quantite_prevue} onChange={f('quantite_prevue')} required />
          </div>
          <div>
            <label className="label">Ville d'enlèvement</label>
            <input className="input" value={form.ville_chargement} onChange={f('ville_chargement')} placeholder="Silo de départ..." />
          </div>
          <div>
            <label className="label">Ville de destination</label>
            <input className="input" value={form.ville_destination} onChange={f('ville_destination')} />
          </div>
          <div className="col-span-2">
            <label className="label">Transporteur *</label>
            <select className="input" value={form.transporteur_id} onChange={f('transporteur_id')} required>
              <option value="">Choisir...</option>
              {transporteurs.map(t => (
                <option key={t.id} value={t.id}>{t.nom}</option>
              ))}
            </select>
            {(() => {
              const t = transporteurs.find(t => t.id === form.transporteur_id)
              return t?.telephone
                ? <a href={`tel:${t.telephone}`} className="mt-1 flex items-center gap-1 text-xs text-green-700 hover:underline">📞 {t.telephone}</a>
                : null
            })()}
          </div>
          <div>
            <label className="label">Pièce client (préfixe)</label>
            <input className="input" value={form.piece_client_prefixe} onChange={f('piece_client_prefixe')} placeholder={prefixes.client} />
          </div>
          <div>
            <label className="label">Pièce client (n°)</label>
            <input className="input" value={form.piece_client_numero} onChange={f('piece_client_numero')} placeholder="Numéro..." />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : 'Ajouter'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
