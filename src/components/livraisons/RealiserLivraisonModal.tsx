'use client'
import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { getPrefixes } from '@/lib/prefixes'
import { formatTonnes } from '@/lib/annee-agricole'

interface Props {
  livraison: any
  contrat: any
  onClose: () => void
  onSaved: () => void
}

export default function RealiserLivraisonModal({ livraison, contrat, onClose, onSaved }: Props) {
  const prefixes = getPrefixes(contrat.famille)
  const [transporteurs, setTransporteurs] = useState<any[]>([])

  const [form, setForm] = useState({
    date_reelle: '',
    quantite_reelle: String(livraison.quantite_prevue ?? ''),
    numero_lettre_voiture: '',
    ville_chargement: livraison.ville_chargement ?? contrat.ville_chargement ?? '',
    ville_destination: livraison.ville_destination ?? '',
    piece_fournisseur_prefixe: livraison.piece_fournisseur_prefixe ?? prefixes.fournisseur,
    piece_fournisseur_numero: livraison.piece_fournisseur_numero ?? '',
    piece_client_prefixe: livraison.piece_client_prefixe ?? prefixes.client,
    piece_client_numero: livraison.piece_client_numero ?? '',
    montant_transport_reel: '',
    transporteur_id: livraison.transporteur_id ?? '',
    numero_mise_a_disposition: livraison.numero_mise_a_disposition ?? '',
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
    setSaving(true)
    const body = {
      type: 'realisee',
      date_reelle: form.date_reelle,
      quantite_reelle: parseFloat(form.quantite_reelle),
      numero_lettre_voiture: form.numero_lettre_voiture || null,
      ville_chargement: form.ville_chargement || null,
      ville_destination: form.ville_destination || null,
      piece_fournisseur_prefixe: form.piece_fournisseur_prefixe || null,
      piece_fournisseur_numero: form.piece_fournisseur_numero || null,
      piece_client_prefixe: form.piece_client_prefixe || null,
      piece_client_numero: form.piece_client_numero || null,
      montant_transport_reel: form.montant_transport_reel ? parseFloat(form.montant_transport_reel) : null,
      transporteur_id: form.transporteur_id || null,
      numero_mise_a_disposition: form.numero_mise_a_disposition || null,
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

  const prevu = livraison.quantite_prevue ? livraison.quantite_prevue * contrat.prix_transport_prevu : null

  return (
    <Modal title="Réaliser la livraison" onClose={onClose} size="md">
      <div className="bg-orange-50 border border-orange-100 rounded-lg px-4 py-2 text-sm text-orange-700 mb-4">
        Livraison planifiée : <strong>{formatTonnes(livraison.quantite_prevue)}</strong>
        {prevu != null && <span className="ml-2 text-gray-500">· Transport prévu : {prevu.toFixed(2)} €</span>}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date réelle *</label>
            <input type="date" className="input" value={form.date_reelle} onChange={f('date_reelle')} required />
          </div>
          <div>
            <label className="label">Quantité réelle (t) *</label>
            <input type="number" step="0.001" className="input" value={form.quantite_reelle} onChange={f('quantite_reelle')} required />
          </div>
          <div className="col-span-2">
            <label className="label">N° lettre de voiture (CMR)</label>
            <input className="input" value={form.numero_lettre_voiture} onChange={f('numero_lettre_voiture')} placeholder="CMR..." />
          </div>
          <div>
            <label className="label">Ville d'enlèvement</label>
            <input className="input" value={form.ville_chargement} onChange={f('ville_chargement')} />
          </div>
          <div>
            <label className="label">Ville de destination</label>
            <input className="input" value={form.ville_destination} onChange={f('ville_destination')} />
          </div>
          {contrat.famille === 'appro' && (
            <div className="col-span-2">
              <label className="label">N° mise à disposition</label>
              <input className="input" value={form.numero_mise_a_disposition} onChange={f('numero_mise_a_disposition')} placeholder="Reçu avant chargement..." />
            </div>
          )}
          <div className="col-span-2">
            <label className="label">Transporteur pour cette livraison</label>
            <select className="input" value={form.transporteur_id} onChange={f('transporteur_id')}>
              <option value="">Par défaut ({contrat.transporteur?.nom ?? '—'})</option>
              {transporteurs.map(t => (
                <option key={t.id} value={t.id}>{t.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Pièce fournisseur ({prefixes.fournisseur})</label>
            <div className="flex gap-1">
              <input className="input w-16 text-center" value={form.piece_fournisseur_prefixe} onChange={f('piece_fournisseur_prefixe')} />
              <input className="input flex-1" value={form.piece_fournisseur_numero} onChange={f('piece_fournisseur_numero')} placeholder="Numéro..." />
            </div>
          </div>
          <div>
            <label className="label">Pièce client ({prefixes.client})</label>
            <div className="flex gap-1">
              <input className="input w-16 text-center" value={form.piece_client_prefixe} onChange={f('piece_client_prefixe')} />
              <input className="input flex-1" value={form.piece_client_numero} onChange={f('piece_client_numero')} placeholder="Numéro..." />
            </div>
          </div>
          <div>
            <label className="label">Montant transport réel (€)</label>
            <input type="number" step="0.01" className="input" value={form.montant_transport_reel} onChange={f('montant_transport_reel')} placeholder="Optionnel" />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : 'Valider la livraison'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
