'use client'
import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { getPrefixes } from '@/lib/prefixes'

interface Props {
  contrat: any
  onClose: () => void
  onSaved: () => void
}

export default function AjouterLivraisonModal({ contrat, onClose, onSaved }: Props) {
  const prefixes = getPrefixes(contrat.famille)
  const [transporteurs, setTransporteurs] = useState<any[]>([])

  // Adresses d'enlèvement : principale + supplémentaires + déjà utilisées sur les livraisons
  const adressesChargement = Array.from(new Set(
    [
      contrat.ville_chargement,
      ...(contrat.adresses_chargement_sup ?? []),
      ...(contrat.livraisons ?? []).map((l: any) => l.ville_chargement),
    ].filter(Boolean)
  ))

  const [form, setForm] = useState({
    mois_prevu: '',
    quantite_prevue: '',
    ville_chargement: contrat.ville_chargement ?? '',
    ville_destination: '',
    piece_fournisseur_prefixe: prefixes.fournisseur,
    piece_fournisseur_numero: '',
    piece_client_prefixe: prefixes.client,
    piece_client_numero: '',
    transporteur_id: '',
    numero_mise_a_disposition: '',
    contrat_vente_id: '',
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

  const ventesLiees = contrat.contrats_vente ?? []

  function onContratVenteChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    const cv = ventesLiees.find((v: any) => v.id === id)
    const villeAgri = cv?.destination_silo ? '' : (cv?.agriculteur?.ville_livraison ?? '')
    setForm(prev => ({ ...prev, contrat_vente_id: id, ville_destination: villeAgri || prev.ville_destination }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const body = {
      contrat_achat_id: contrat.id,
      type: 'planifiee',
      mois_prevu: form.mois_prevu + '-01',
      quantite_prevue: parseFloat(form.quantite_prevue),
      ville_chargement: form.ville_chargement || null,
      ville_destination: form.ville_destination || null,
      piece_fournisseur_prefixe: form.piece_fournisseur_prefixe || null,
      piece_fournisseur_numero: form.piece_fournisseur_numero || null,
      piece_client_prefixe: form.piece_client_prefixe || null,
      piece_client_numero: form.piece_client_numero || null,
      transporteur_id: form.transporteur_id || null,
      numero_mise_a_disposition: form.numero_mise_a_disposition || null,
      contrat_vente_id: form.contrat_vente_id || null,
    }
    const res = await fetch('/api/livraisons', {
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
    <Modal title="Ajouter une livraison planifiée" onClose={onClose} size="md">
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
            <input className="input" list="adresses-chargement" value={form.ville_chargement} onChange={f('ville_chargement')} placeholder="Saisir ou choisir..." />
            <datalist id="adresses-chargement">
              {adressesChargement.map((a: string) => <option key={a} value={a} />)}
            </datalist>
          </div>
          <div>
            <label className="label">Ville de destination</label>
            <input className="input" value={form.ville_destination} onChange={f('ville_destination')} />
          </div>
          <div className="col-span-2">
            <label className="label">Affectation de cette livraison</label>
            <select className="input" value={form.contrat_vente_id} onChange={onContratVenteChange}>
              <option value="">— Non affecté —</option>
              {ventesLiees.map((cv: any) => (
                <option key={cv.id} value={cv.id}>
                  {cv.destination_silo
                    ? `🏚 ${cv.silo_nom} · ${cv.quantite} t`
                    : `${cv.numero_contrat} · ${cv.agriculteur?.nom} · ${cv.quantite} t`}
                </option>
              ))}
            </select>
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
            <label className="label">Pièce fournisseur (préfixe)</label>
            <input className="input" value={form.piece_fournisseur_prefixe} onChange={f('piece_fournisseur_prefixe')} placeholder={prefixes.fournisseur} />
          </div>
          <div>
            <label className="label">Pièce fournisseur (n°)</label>
            <input className="input" value={form.piece_fournisseur_numero} onChange={f('piece_fournisseur_numero')} placeholder="Numéro..." />
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
